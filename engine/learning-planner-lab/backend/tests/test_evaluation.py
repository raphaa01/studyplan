from __future__ import annotations

import torch

from learning_lab.evaluation import evaluate_model
from learning_lab.generator import SituationGenerator
from learning_lab.model import PlannerActorCritic


def test_evaluation_is_reproducible() -> None:
    torch.manual_seed(44)
    model = PlannerActorCritic()
    generator = SituationGenerator(3)
    situations = [generator.generate(5, seed=500 + i) for i in range(5)]
    first = evaluate_model(model, situations)
    second = evaluate_model(model, situations)
    # Scores and buckets are deterministic; measured wall-clock inference time is not.
    assert first["mean_reward"] == second["mean_reward"]
    assert first["median_reward"] == second["median_reward"]
    assert first["by_exam_count"] == second["by_exam_count"]
    assert first["sample_count"] == second["sample_count"]
    assert first["mean_inference_ms"] > 0
    assert second["mean_inference_ms"] > 0
