from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any

from .config import MODELS_DIR, REGISTRY_FILE, REWARD_VERSION, SCHEMA_VERSION, ensure_directories
from .model import PlannerActorCritic, load_model, save_model


class ModelRegistry:
    def __init__(self, path: Path = REGISTRY_FILE):
        ensure_directories()
        self.path = path
        self.lock = RLock()

    def list(self) -> list[dict[str, Any]]:
        with self.lock:
            items = json.loads(self.path.read_text(encoding="utf-8")) if self.path.exists() else []
            known = {item["id"] for item in items}
            for directory in MODELS_DIR.glob("model-v[0-9][0-9][0-9]"):
                if directory.name in known or not (directory / "model.pt").exists():
                    continue
                version = int(directory.name.rsplit("v", 1)[1])
                metadata_path = directory / "metadata.json"
                metadata = json.loads(metadata_path.read_text(encoding="utf-8")) if metadata_path.exists() else {}
                items.append({
                    "id": directory.name, "name": qecore_name(version), "version": version,
                    "model_path": str(directory / "model.pt"), "size_bytes": (directory / "model.pt").stat().st_size,
                    "reward_version": metadata.get("reward_version", "2.0" if version <= 7 else REWARD_VERSION),
                    "schema_version": metadata.get("schema_version", "2.0" if version <= 7 else SCHEMA_VERSION),
                    **metadata,
                })
            for item in items:
                item.setdefault("reward_version", "1.0")
                item.setdefault("schema_version", "2.0")
                item.setdefault("created_at", datetime.fromtimestamp(Path(item["model_path"]).stat().st_mtime, timezone.utc).isoformat())
                item.setdefault("architecture", "SharedExamMLP-64")
                item.setdefault("parameters", 0)
                item.setdefault("training_steps", 0)
                item.setdefault("training_duration_seconds", 0)
                item.setdefault("seed", 0)
                item.setdefault("evaluation_score", 0.0)
                item.setdefault("fresh_test_score", 0.0)
                item.setdefault("evaluation", {"mean_reward": item["evaluation_score"], "mean_inference_ms": 0.0, "by_exam_count": {}})
                item.setdefault("baselines", {})
                item.setdefault("exceeds_8mb", item.get("size_bytes", 0) > 8 * 1024 * 1024)
                item["name"] = qecore_name(int(item["version"])) if str(item.get("name", "")).startswith("model-v") else item.get("name", qecore_name(int(item["version"])))
                item["training_compatible"] = item["schema_version"] == SCHEMA_VERSION and item["reward_version"] == REWARD_VERSION
            return items

    def get(self, model_id: str) -> dict[str, Any] | None:
        return next((item for item in self.list() if item["id"] == model_id), None)

    def next_id(self) -> str:
        existing = self.list()
        versions = [int(item["version"]) for item in existing]
        versions.extend(int(path.name.rsplit("v", 1)[1]) for path in MODELS_DIR.glob("model-v[0-9][0-9][0-9]"))
        return f"model-v{max(versions, default=0) + 1:03d}"

    def register(
        self,
        model: PlannerActorCritic,
        metadata: dict[str, Any],
        optimizer_state: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        with self.lock:
            model_id = self.next_id()
            version = int(model_id.rsplit("v", 1)[1])
            directory = MODELS_DIR / model_id
            model_path = directory / "model.pt"
            save_model(model, model_path, {"optimizer_state": optimizer_state, "metadata": metadata})
            item = {
                "id": model_id,
                "name": qecore_name(version),
                "version": version,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "parent_model": metadata.get("parent_model"),
                "architecture": f"SharedPlanningTargetMLP-{model.hidden}",
                "parameters": model.parameter_count(),
                "size_bytes": model_path.stat().st_size,
                "exceeds_8mb": model_path.stat().st_size > 8 * 1024 * 1024,
                "model_path": str(model_path),
                **metadata,
            }
            items = self.list()
            items.append(item)
            self._write(items)
            return item

    def load(self, model_id: str) -> tuple[PlannerActorCritic, dict[str, Any]]:
        item = self.get(model_id)
        if not item:
            raise KeyError(model_id)
        model, payload = load_model(Path(item["model_path"]))
        return model, {"registry": item, **payload}

    def rename(self, model_id: str, name: str) -> dict[str, Any]:
        with self.lock:
            items = self.list()
            item = next((value for value in items if value["id"] == model_id), None)
            if item is None:
                raise KeyError(model_id)
            item["name"] = name.strip()
            self._write(items)
            return item

    def delete(self, model_id: str) -> None:
        with self.lock:
            items = self.list()
            item = next((value for value in items if value["id"] == model_id), None)
            if item is None:
                raise KeyError(model_id)
            directory = Path(item["model_path"]).parent.resolve()
            models_root = MODELS_DIR.resolve()
            if models_root not in directory.parents:
                raise RuntimeError("refusing to delete outside models directory")
            if directory.exists():
                shutil.rmtree(directory)
            self._write([value for value in items if value["id"] != model_id])

    def _write(self, items: list[dict[str, Any]]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")
        temporary.replace(self.path)


def qecore_name(version: int) -> str:
    return f"QECore v1.{version:02d}"
