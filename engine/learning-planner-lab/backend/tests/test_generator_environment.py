from __future__ import annotations

import numpy as np

from learning_lab.config import MAX_EXAMS, MAX_TARGETS
from learning_lab.environment import LearningPlanEnv
from learning_lab.generator import SituationGenerator
from learning_lab.targets import targets_for


def test_generator_creates_valid_diverse_situations() -> None:
    generator = SituationGenerator(123)
    for level in range(1, 6):
        for seed in range(20):
            situation = generator.generate(level, seed=1000 * level + seed)
            assert 1 <= len(situation.exams) <= MAX_EXAMS
            assert situation.slots
            assert all(1 <= exam.days_until <= 60 for exam in situation.exams)
            starts = [(slot.day, slot.start_minute) for slot in situation.slots]
            assert len(starts) == len(set(starts))
            assert all(slot.end_minute - slot.start_minute == 30 for slot in situation.slots)


def test_action_mask_prevents_missing_and_expired_exams() -> None:
    situation = SituationGenerator(8).generate(level=5, seed=99)
    env = LearningPlanEnv()
    observation = env.reset(situation)
    assert observation.action_mask.shape == (MAX_TARGETS + 1,)
    assert observation.action_mask[0]
    assert not observation.action_mask[len(targets_for(situation)) + 1 :].any()
    while True:
        mask = env.action_mask()
        action = int(np.flatnonzero(mask)[-1])
        _, _, done, info = env.step(action)
        assert not info["invalid_action"]
        if done:
            break


def test_invalid_action_is_safe_and_penalized() -> None:
    env = LearningPlanEnv()
    env.reset(seed=22)
    _, reward, _, info = env.step(MAX_TARGETS + 3)
    assert info["invalid_action"]
    assert reward < 0

