from __future__ import annotations

from learning_lab.baselines import BASELINES
from learning_lab.generator import SituationGenerator


def test_all_baselines_produce_valid_complete_plans() -> None:
    situation = SituationGenerator(5).generate(5, seed=888)
    for name, scheduler in BASELINES.items():
        result = scheduler(situation, seed=1) if name == "random" else scheduler(situation)
        assert len(result.assignments) == len(situation.slots)
        assert result.reward.invalid == 0
        for index, action in enumerate(result.assignments):
            assert 0 <= action <= len(situation.exams)
            if action:
                assert situation.slots[index].day < situation.exams[action - 1].days_until
