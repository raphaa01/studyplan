from __future__ import annotations

from learning_lab.environment import LearningPlanEnv
from learning_lab.reward import score_plan_v3
from learning_lab.schemas import Exam, LearningFeedback, LearningRoutine, Situation, StudySlot, TimeWindow
from learning_lab.targets import feedback_multiplier, targets_for


def math_situation(*, same_subject: bool = True, two_weeks: bool = False) -> Situation:
    days = [0, 1, 2, 3] + ([7, 8] if two_weeks else [])
    slots = [StudySlot(index=i, day=day, start_minute=960, end_minute=990) for i, day in enumerate(days)]
    return Situation(
        id="math-v3",
        exams=[Exam(id="math-test", subject="Mathematik", subject_id="mathematik", kind="exam",
                    days_until=5, difficulty=8, importance=9, estimated_need_minutes=120)],
        routines=[LearningRoutine(id="math-routine", subject="Mathematik" if same_subject else "Englisch",
                    subject_id="mathematik" if same_subject else "englisch", title="Routine",
                    sessions_per_week=2, learning_method="interleaving")],
        windows=[TimeWindow(day=day, start_minute=960, end_minute=990) for day in days],
        slots=slots, curriculum_level=5, seed=1, schema_version="3.0",
    )


def test_exam_sessions_credit_same_subject_routine_without_double_minutes() -> None:
    situation = math_situation()
    reward = score_plan_v3(situation, [1, 1, 0, 0])
    assert reward.per_routine["math-routine"] == 100
    assert reward.exam_substitution_credit > 0
    env = LearningPlanEnv(); env.reset(situation)
    env.step(1); env.step(1)
    assert not env.action_mask()[2]


def test_foreign_routine_remains_available_and_exam_wins_single_scarce_slot() -> None:
    situation = math_situation(same_subject=False).model_copy(update={"slots": math_situation().slots[:1]})
    exam = score_plan_v3(situation, [1])
    routine = score_plan_v3(situation, [2])
    assert exam.total > routine.total


def test_routine_returns_in_new_week_after_exam_deadline() -> None:
    situation = math_situation(two_weeks=True)
    env = LearningPlanEnv(); env.reset(situation)
    env.step(1); env.step(1); env.step(0); env.step(0)
    assert env.action_mask()[2]


def test_feedback_adjustment_is_bounded_and_directional() -> None:
    hard = LearningFeedback(difficulty=1, confidence=0, completion_rate=0, missed_sessions=4, planned_minutes=60, actual_minutes=30)
    easy = LearningFeedback(difficulty=0, confidence=1, completion_rate=1, planned_minutes=60, actual_minutes=90)
    assert .75 <= feedback_multiplier(easy) < 1 < feedback_multiplier(hard) <= 1.30


def test_target_presence_is_independent_of_deadline_and_mask() -> None:
    env = LearningPlanEnv(); observation = env.reset(math_situation())
    assert observation.exams[1, 0] == 1
    assert observation.exams[1, 3] == 0
    assert len(targets_for(env.situation)) == 2
