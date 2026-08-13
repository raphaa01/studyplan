from __future__ import annotations

import math
import threading

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
    assert (result.run_directory / "final.pt").exists()
