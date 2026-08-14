from __future__ import annotations

from learning_lab.baselines import BASELINES
from learning_lab.generator import SituationGenerator
from learning_lab.targets import targets_for


def test_all_baselines_produce_valid_complete_plans() -> None:
    situation = SituationGenerator(5).generate(5, seed=888)
    for name, scheduler in BASELINES.items():
        result = scheduler(situation, seed=1) if name == "random" else scheduler(situation)
        assert len(result.assignments) == len(situation.slots)
        assert result.reward.invalid == 0
        for index, action in enumerate(result.assignments):
            assert 0 <= action <= len(targets_for(situation))
            if action:
                target = targets_for(situation)[action - 1]
                assert target.deadline_day is None or situation.slots[index].day < target.deadline_day
