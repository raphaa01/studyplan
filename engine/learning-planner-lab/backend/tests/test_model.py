from __future__ import annotations

import numpy as np
import torch

from learning_lab.config import MAX_TARGETS
from learning_lab.environment import LearningPlanEnv
from learning_lab.generator import SituationGenerator
from learning_lab.model import PlannerActorCritic, generate_plan, load_model, observation_tensors, save_model
from learning_lab.targets import targets_for


def test_model_handles_valid_situation_and_stays_tiny(tmp_path) -> None:
    model = PlannerActorCritic()
    situation = SituationGenerator(2).generate(5, seed=77)
    result = generate_plan(model, situation)
    assert len(result.assignments) == len(situation.slots)
    assert model.estimated_size_bytes() < 1_000_000
    assert result.inference_ms < 3000

    path = tmp_path / "model.pt"
    save_model(model, path, {"step": 12})
    restored, metadata = load_model(path)
    assert metadata["step"] == 12
    for left, right in zip(model.parameters(), restored.parameters()):
        assert torch.equal(left, right)


def test_policy_is_permutation_equivariant() -> None:
    torch.manual_seed(4)
    model = PlannerActorCritic().eval()
    situation = SituationGenerator(4).generate(3, seed=91)
    observation = LearningPlanEnv().reset(situation)
    exams, globals_, mask = observation_tensors([observation])
    logits, value = model(exams, globals_, mask)

    count = len(targets_for(situation))
    permutation = np.arange(MAX_TARGETS)
    permutation[:count] = permutation[:count][::-1]
    perm_exams = exams[:, permutation]
    perm_mask = torch.cat([mask[:, :1], mask[:, 1:][:, permutation]], dim=1)
    perm_logits, perm_value = model(perm_exams, globals_, perm_mask)
    assert torch.allclose(value, perm_value, atol=1e-6)
    assert torch.allclose(logits[:, 1:][:, permutation], perm_logits[:, 1:], atol=1e-6)
