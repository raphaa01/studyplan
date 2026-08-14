from __future__ import annotations

import math
import threading
from pathlib import Path

from learning_lab.schemas import TrainingConfig
from learning_lab.trainer import train_ppo


def test_short_training_updates_and_saves_checkpoint(tmp_path, monkeypatch) -> None:
    import learning_lab.trainer as trainer_module

    monkeypatch.setattr(trainer_module, "RUNS_DIR", tmp_path)
    metrics: list[dict] = []
    config = TrainingConfig(
        total_steps=128, rollout_steps=32, parallel_envs=2, batch_size=32,
        epochs=1, checkpoint_interval=128, validation_size=16,
    )
    result = train_ppo(config, "test-run", metrics.append, threading.Event(), threading.Event())
    assert result.steps == 128
    assert math.isfinite(result.best_validation_reward)
    assert 0 <= result.best_step <= result.steps
    assert (result.run_directory / "last.pt").exists()
    assert (result.run_directory / "final.pt").exists()
    assert result.episodes > 0
    assert metrics


def test_training_resumes_steps_and_optimizer_from_checkpoint(tmp_path, monkeypatch) -> None:
    import learning_lab.trainer as trainer_module

    monkeypatch.setattr(trainer_module, "RUNS_DIR", tmp_path)
    first_config = TrainingConfig(
        total_steps=128, rollout_steps=32, parallel_envs=2, batch_size=32,
        epochs=1, checkpoint_interval=128, validation_size=16,
    )
    train_ppo(first_config, "resume-run", lambda _: None, threading.Event(), threading.Event())
    checkpoint = tmp_path / "resume-run" / "checkpoint.pt"
    resumed_config = first_config.model_copy(update={"total_steps": 256})
    result = train_ppo(
        resumed_config, "resume-run", lambda _: None, threading.Event(), threading.Event(),
        resume_path=checkpoint,
    )
    assert result.steps == 256
    assert (result.run_directory / "last.pt").exists()


def test_v007_compatible_transfer_smoke_training(tmp_path, monkeypatch) -> None:
    import learning_lab.trainer as trainer_module

    monkeypatch.setattr(trainer_module, "RUNS_DIR", tmp_path)
    config = TrainingConfig(
        total_steps=128, rollout_steps=32, parallel_envs=2, batch_size=32, epochs=1,
        checkpoint_interval=128, validation_size=16, init_mode="compatible_transfer",
        parent_model="model-v007",
    )
    parent = Path(__file__).resolve().parents[2] / "models" / "model-v007" / "model.pt"
    result = train_ppo(config, "transfer-smoke", lambda _: None, threading.Event(), threading.Event(), parent_path=parent, load_parent_optimizer=False)
    assert result.steps == 128
    assert (result.run_directory / "transfer.json").read_text(encoding="utf-8").count("exam_encoder") > 0
    assert result.episodes > 0
    assert (result.run_directory / "final.pt").exists()
