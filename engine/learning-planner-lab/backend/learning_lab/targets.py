from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from .config import SLOT_MINUTES
from .schemas import Exam, LearningFeedback, LearningMethod, LearningRoutine, PlanningTarget, Situation


SUBJECT_ALIASES = {
    "mathe": "mathematik", "math": "mathematik", "deutsch": "deutsch",
    "englisch": "englisch", "english": "englisch", "bio": "biologie",
    "chemie": "chemie", "physik": "physik", "geschichte": "geschichte",
    "informatik": "informatik", "geographie": "geografie", "erdkunde": "geografie",
}


def normalize_subject(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.strip().lower())
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return SUBJECT_ALIASES.get(normalized, normalized or "unbekannt")


@dataclass(frozen=True)
class MethodProfile:
    desired_block_slots: float
    spacing_preference: float
    interleaving_preference: float
    preferred_phase: float
    retrieval_intensity: float


METHOD_PROFILES: dict[str, MethodProfile] = {
    "pomodoro": MethodProfile(1.0, .45, .25, .5, .45),
    "spaced_repetition": MethodProfile(1.0, 1.0, .35, .35, .75),
    "interleaving": MethodProfile(1.0, .65, 1.0, .5, .6),
    "active_recall": MethodProfile(1.0, .85, .55, .55, 1.0),
    "exam_simulation": MethodProfile(2.0, .2, .05, .9, .85),
}


def resolve_method(method: LearningMethod, *, kind: str, days_until: int | None, difficulty: int) -> LearningMethod:
    if method != "auto":
        return method
    if kind == "exam" and days_until is not None and days_until <= 7:
        return "exam_simulation"
    if difficulty >= 8:
        return "active_recall"
    return "spaced_repetition" if kind == "routine" else "interleaving"


def method_profile(method: LearningMethod, *, kind: str, days_until: int | None, difficulty: int) -> MethodProfile:
    return METHOD_PROFILES[resolve_method(method, kind=kind, days_until=days_until, difficulty=difficulty)]


def feedback_multiplier(feedback: LearningFeedback | None) -> float:
    if feedback is None:
        return 1.0
    time_ratio = feedback.actual_minutes / max(feedback.planned_minutes, SLOT_MINUTES)
    pressure = (
        .28 * (feedback.difficulty - .5) + .28 * (.5 - feedback.confidence)
        + .20 * (1 - feedback.completion_rate) + .04 * min(feedback.missed_sessions, 4)
        + .12 * max(0, 1 - time_ratio) - .06 * max(0, time_ratio - 1)
    )
    if feedback.days_since_success is not None:
        pressure += .03 * min(feedback.days_since_success / 14, 1)
    return min(1.30, max(.75, 1 + pressure))


def targets_for(situation: Situation) -> list[PlanningTarget]:
    targets: list[PlanningTarget] = []
    for exam in situation.exams:
        subject_id = exam.subject_id or normalize_subject(exam.subject)
        base_need = exam.estimated_need_minutes or (45 + 28 * exam.difficulty + 18 * exam.importance)
        targets.append(PlanningTarget(
            id=exam.id, kind="exam", subject_id=subject_id, subject=exam.subject,
            difficulty=exam.difficulty, importance=exam.importance,
            learning_method=resolve_method(exam.learning_method, kind="exam", days_until=exam.days_until, difficulty=exam.difficulty),
            deadline_day=exam.days_until, estimated_need_minutes=round(base_need * feedback_multiplier(exam.feedback)),
            invested_minutes=exam.invested_minutes, flexible=False, feedback=exam.feedback,
        ))
    for routine in situation.routines:
        if not routine.enabled:
            continue
        subject_id = routine.subject_id or normalize_subject(routine.subject)
        targets.append(PlanningTarget(
            id=routine.id, kind="routine", subject_id=subject_id, subject=routine.subject,
            difficulty=routine.difficulty, importance=routine.importance,
            learning_method=resolve_method(routine.learning_method, kind="routine", days_until=None, difficulty=routine.difficulty),
            estimated_need_minutes=round(routine.sessions_per_week * routine.preferred_session_minutes * feedback_multiplier(routine.feedback)),
            sessions_per_week=routine.sessions_per_week,
            preferred_session_minutes=routine.preferred_session_minutes, flexible=routine.flexible,
            preferred_weekdays=routine.preferred_weekdays, feedback=routine.feedback,
        ))
    return targets


def exam_credit_routines(situation: Situation, exam: Exam) -> list[LearningRoutine]:
    exam_subject = exam.subject_id or normalize_subject(exam.subject)
    return [r for r in situation.routines if r.enabled and (r.subject_id or normalize_subject(r.subject)) == exam_subject]
