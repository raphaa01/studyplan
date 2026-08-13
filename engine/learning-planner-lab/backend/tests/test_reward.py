from __future__ import annotations

import math

from learning_lab.generator import SituationGenerator
from learning_lab.reward import score_plan
from learning_lab.schemas import Exam, Situation, StudySlot, TimeWindow


def simple_situation() -> Situation:
    exams = [
        Exam(id="math", subject="Mathematik", kind="exam", days_until=5, difficulty=9, importance=9, estimated_need_minutes=240),
        Exam(id="history", subject="Geschichte", kind="test", days_until=10, difficulty=4, importance=5, estimated_need_minutes=150),
    ]
    slots = [StudySlot(index=i, day=day, start_minute=16 * 60 + part * 30, end_minute=16 * 60 + (part + 1) * 30)
             for i, (day, part) in enumerate((d, p) for d in range(4) for p in range(4))]
    windows = [TimeWindow(day=d, start_minute=16 * 60, end_minute=18 * 60) for d in range(4)]
    return Situation(id="test", exams=exams, windows=windows, slots=slots, curriculum_level=3, seed=1)


def test_reward_is_finite_for_many_generated_plans() -> None:
    generator = SituationGenerator(123)
    for seed in range(50):
        situation = generator.generate(5, seed)
        reward = score_plan(situation, [0] * len(situation.slots))
        assert math.isfinite(reward.total)


def test_balanced_preparation_beats_ignoring_exam() -> None:
    situation = simple_situation()
    only_nearest = [1] * len(situation.slots)
    balanced = [1, 1, 0, 2, 1, 1, 0, 2, 1, 0, 2, 2, 1, 0, 2, 0]
    assert score_plan(situation, balanced).total > score_plan(situation, only_nearest).total


def test_spacing_beats_equal_duration_cramming() -> None:
    situation = simple_situation()
    spaced = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
    crammed = [0] * 12 + [1] * 4
    assert score_plan(situation, spaced).total > score_plan(situation, crammed).total


def test_micro_switching_is_not_reward_hack() -> None:
    situation = simple_situation()
    frantic = [1, 2] * 8
    sessions = [1, 1, 2, 2] * 4
    assert score_plan(situation, sessions).total > score_plan(situation, frantic).total


def test_all_breaks_and_forced_full_utilization_are_not_optimal() -> None:
    situation = simple_situation()
    all_breaks = [0] * len(situation.slots)
    sensible = [1, 1, 0, 2, 1, 1, 0, 2, 1, 0, 2, 0, 0, 0, 0, 0]
    forced = [1] * len(situation.slots)
    sensible_reward = score_plan(situation, sensible).total
    assert sensible_reward > score_plan(situation, all_breaks).total
    assert sensible_reward > score_plan(situation, forced).total


def single_exam_situation(need: int = 180) -> Situation:
    slots: list[StudySlot] = []
    windows: list[TimeWindow] = []
    index = 0
    for day in range(5):
        windows.append(TimeWindow(day=day, start_minute=16 * 60, end_minute=17 * 60))
        for part in range(2):
            slots.append(StudySlot(
                index=index, day=day, start_minute=16 * 60 + part * 30,
                end_minute=16 * 60 + (part + 1) * 30,
            ))
            index += 1
    return Situation(
        id="single", exams=[Exam(
            id="biology", subject="Biologie", kind="exam", days_until=6,
            difficulty=7, importance=8, estimated_need_minutes=need,
        )], windows=windows, slots=slots, curriculum_level=5, seed=7,
    )


def test_each_useful_increment_improves_until_need_then_overlearning_lowers_score() -> None:
    situation = single_exam_situation(need=180)
    distributed_order = [0, 2, 4, 6, 8, 1, 3, 5, 7, 9]
    scores: list[float] = []
    for studied_slots in range(11):
        assignments = [0] * len(situation.slots)
        for index in distributed_order[:studied_slots]:
            assignments[index] = 1
        scores.append(score_plan(situation, assignments).total)

    # Six slots are the estimated 180-minute need.
    assert all(right > left for left, right in zip(scores[:6], scores[1:7]))
    assert scores[6] > scores[7] > scores[8] > scores[9] > scores[10]


def test_reward_v2_reports_overlearning_and_neutral_idle_time() -> None:
    situation = single_exam_situation(need=90)
    useful = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0]
    overfilled = [1] * len(situation.slots)
    idle = [0] * len(situation.slots)

    useful_reward = score_plan(situation, useful)
    overfilled_reward = score_plan(situation, overfilled)
    idle_reward = score_plan(situation, idle)
    assert useful_reward.reward_version == "2.0"
    assert useful_reward.total > overfilled_reward.total > idle_reward.total
    assert overfilled_reward.overlearning < 0
    assert idle_reward.utilization == 0


def test_cramming_is_only_penalized_when_earlier_opportunities_existed() -> None:
    exam = Exam(
        id="chem", subject="Chemie", kind="exam", days_until=2,
        difficulty=6, importance=7, estimated_need_minutes=120,
    )
    late_only = Situation(
        id="forced-late", exams=[exam],
        windows=[TimeWindow(day=1, start_minute=16 * 60, end_minute=18 * 60)],
        slots=[StudySlot(index=i, day=1, start_minute=16 * 60 + i * 30, end_minute=16 * 60 + (i + 1) * 30) for i in range(4)],
        curriculum_level=5, seed=3,
    )
    assert score_plan(late_only, [1, 1, 1, 1]).cramming == 0


def test_priority_matters_but_does_not_justify_abandoning_other_exam() -> None:
    situation = simple_situation()
    higher_priority = [1, 1, 0, 0] * 4
    lower_priority = [2, 2, 0, 0] * 4
    balanced = [1, 1, 0, 2, 1, 1, 0, 2, 1, 0, 2, 2, 1, 0, 2, 0]
    assert score_plan(situation, higher_priority).total > score_plan(situation, lower_priority).total
    assert score_plan(situation, balanced).total > score_plan(situation, higher_priority).total
