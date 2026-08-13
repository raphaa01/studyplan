from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any

from .config import MODELS_DIR, REGISTRY_FILE, ensure_directories
from .model import PlannerActorCritic, load_model, save_model


class ModelRegistry:
    def __init__(self, path: Path = REGISTRY_FILE):
        ensure_directories()
        self.path = path
        self.lock = RLock()

    def list(self) -> list[dict[str, Any]]:
        with self.lock:
            if not self.path.exists():
                return []
            items = json.loads(self.path.read_text(encoding="utf-8"))
            for item in items:
                item.setdefault("reward_version", "1.0")
            return items

    def get(self, model_id: str) -> dict[str, Any] | None:
        return next((item for item in self.list() if item["id"] == model_id), None)

    def next_id(self) -> str:
        existing = self.list()
        versions = [int(item["version"]) for item in existing]
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
                "name": model_id,
                "version": version,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "parent_model": metadata.get("parent_model"),
                "architecture": f"SharedExamMLP-{model.hidden}",
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
