from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import psutil

from .config import DATA_DIR, EVALUATION_FILE, REWARD_VERSION, REWARD_WEIGHTS, VALIDATION_SEED, ensure_directories
from .evaluation import evaluate_baselines, evaluate_model
from .exporter import export_onnx
from .generator import SituationGenerator, ensure_evaluation_set
from .registry import ModelRegistry
from .model import PlannerActorCritic
from .schemas import TrainingConfig, TrainingStatus
from .trainer import train_ppo


class TrainingManager:
    def __init__(self, registry: ModelRegistry):
        ensure_directories()
        self.registry = registry
        self._lock = threading.RLock()
        self._thread: threading.Thread | None = None
        self._pause = threading.Event()
        self._stop = threading.Event()
        self._status = TrainingStatus()
        self._process = psutil.Process()

    def status(self) -> TrainingStatus:
        with self._lock:
            status = self._status.model_copy(deep=True)
        status.cpu_percent = psutil.cpu_percent(interval=None)
        status.ram_percent = psutil.virtual_memory().percent
        status.threads = self._process.num_threads()
        return status

    def start(self, config: TrainingConfig) -> TrainingStatus:
        with self._lock:
            if self._thread and self._thread.is_alive():
                raise RuntimeError("training is already active")
            if config.parent_model and not self.registry.get(config.parent_model):
                raise KeyError(config.parent_model)
            run_id = f"run-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:6]}"
            self._pause.clear()
            self._stop.clear()
            parent = self.registry.get(config.parent_model) if config.parent_model else None
            current_size = int(parent["size_bytes"]) if parent else PlannerActorCritic().estimated_size_bytes()
            self._status = TrainingStatus(
                state="running", run_id=run_id, started_at=datetime.now(timezone.utc),
                message="PPO training is running", total_steps=config.total_steps,
                learning_rate=config.learning_rate, model_size_bytes=current_size,
            )
            self._thread = threading.Thread(target=self._run, args=(config, run_id), daemon=True)
            self._thread.start()
            return self.status()

    def pause(self) -> TrainingStatus:
        with self._lock:
            if self._status.state != "running":
                raise RuntimeError("training is not running")
            self._pause.set()
            self._status.state = "paused"
            self._status.message = "Training paused; model state is retained in memory"
        return self.status()

    def resume(self) -> TrainingStatus:
        with self._lock:
            if self._status.state != "paused":
                raise RuntimeError("training is not paused")
            self._pause.clear()
            self._status.state = "running"
            self._status.message = "PPO training resumed"
        return self.status()

    def stop(self) -> TrainingStatus:
        with self._lock:
            if self._status.state not in ("running", "paused"):
                raise RuntimeError("training is not active")
            self._pause.clear()
            self._stop.set()
            self._status.state = "stopping"
            self._status.message = "Finishing the current rollout and saving an interrupted checkpoint"
        return self.status()

    def _metric(self, metrics: dict[str, float | int | str]) -> None:
        with self._lock:
            for key, value in metrics.items():
                if hasattr(self._status, key):
                    setattr(self._status, key, value)
            point = {
                "steps": self._status.steps,
                "reward": round(self._status.reward, 5),
                "moving_reward": round(self._status.moving_reward, 5),
                "loss": round(self._status.loss, 5),
                "policy_loss": round(self._status.policy_loss, 5),
                "value_loss": round(self._status.value_loss, 5),
                "entropy": round(self._status.entropy, 5),
                # Only emit a validation point when this update actually ran an
                # evaluation. Repeating the last value makes a sparse validation
                # curve look denser (and more certain) than it really is.
                "evaluation_reward": (
                    round(float(metrics["evaluation_reward"]), 5)
                    if metrics.get("evaluation_reward") is not None else None
                ),
            }
            self._status.history.append(point)
            self._status.history = self._status.history[-500:]

    def _run(self, config: TrainingConfig, run_id: str) -> None:
        try:
            parent_path = None
            load_parent_optimizer = True
            if config.parent_model:
                parent = self.registry.get(config.parent_model)
                parent_path = Path(parent["model_path"]) if parent else None
                load_parent_optimizer = bool(parent and parent.get("reward_version") == REWARD_VERSION)
            result = train_ppo(
                config=config, run_id=run_id, callback=self._metric,
                pause_event=self._pause, stop_event=self._stop, parent_path=parent_path,
                load_parent_optimizer=load_parent_optimizer,
            )
            with self._lock:
                history_snapshot = list(self._status.history)
            (result.run_directory / "training_history.json").write_text(
                json.dumps(history_snapshot, indent=2), encoding="utf-8"
            )
            if result.stopped:
                with self._lock:
                    self._status.state = "idle"
                    self._status.message = f"Training stopped; checkpoint saved in {result.run_directory.name}"
                return

            if config.max_episodes is not None and result.episodes >= config.max_episodes:
                with self._lock:
                    self._status.total_steps = result.steps

            with self._lock:
                self._status.message = "Running the fixed 1,000-situation evaluation"
            fixed = ensure_evaluation_set()
            fixed_result = evaluate_model(result.model, fixed)
            self._status.evaluation_reward = float(fixed_result["mean_reward"])

            with self._lock:
                self._status.message = "Running fresh holdout evaluation and baseline comparison"
            fresh_generator = SituationGenerator(config.seed + 9_999_991)
            fresh = [fresh_generator.generate(5, seed=config.seed + 2_000_000 + i) for i in range(250)]
            fresh_result = evaluate_model(result.model, fresh)
            baselines = self._baseline_results(fixed)
            metadata = {
                "parent_model": config.parent_model,
                "training_steps": result.steps,
                "training_episodes": result.episodes,
                "training_duration_seconds": result.duration_seconds,
                "seed": config.seed,
                "final_training_reward": result.final_reward,
                "best_validation_reward": result.best_validation_reward,
                "best_step": result.best_step,
                "selected_best_checkpoint": result.selected_best_checkpoint,
                "evaluation_score": fixed_result["mean_reward"],
                "fresh_test_score": fresh_result["mean_reward"],
                "evaluation": fixed_result,
                "fresh_evaluation": fresh_result,
                "baselines": baselines,
                "hyperparameters": config.model_dump(mode="json"),
                "environment": {
                    "slot_minutes": 30, "max_exams": 8, "curriculum": config.curriculum,
                    "validation_seed": VALIDATION_SEED,
                },
                "reward_version": REWARD_VERSION,
                "reward_weights": REWARD_WEIGHTS.to_dict(),
                "parent_optimizer_restored": load_parent_optimizer,
                "software_version": "0.2.0",
            }
            item = self.registry.register(result.model, metadata, result.optimizer_state)
            model_dir = Path(item["model_path"]).parent
            try:
                onnx_result = export_onnx(result.model, model_dir / "model.onnx")
                item["onnx"] = onnx_result
                items = self.registry.list()
                for registry_item in items:
                    if registry_item["id"] == item["id"]:
                        registry_item.update(item)
                self.registry._write(items)
            except Exception as exc:  # PyTorch model remains valid even if optional export fails.
                item["onnx_error"] = str(exc)

            with self._lock:
                self._status.state = "completed"
                self._status.message = f"{item['id']} trained, evaluated and saved"
                self._status.model_size_bytes = int(item["size_bytes"])
        except Exception as exc:
            with self._lock:
                self._status.state = "failed"
                self._status.message = f"{type(exc).__name__}: {exc}"

    def _baseline_results(self, situations: list) -> dict[str, object]:
        cache_path = DATA_DIR / "baseline_evaluation.json"
        if cache_path.exists():
            cached = json.loads(cache_path.read_text(encoding="utf-8"))
            if (
                cached.get("evaluation_file") == str(EVALUATION_FILE)
                and cached.get("sample_count") == len(situations)
                and cached.get("reward_version") == REWARD_VERSION
            ):
                return cached["results"]
        results = evaluate_baselines(situations)
        cache_path.write_text(json.dumps({
            "evaluation_file": str(EVALUATION_FILE), "sample_count": len(situations),
            "reward_version": REWARD_VERSION, "results": results,
        }, indent=2), encoding="utf-8")
        return results
