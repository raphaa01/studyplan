from __future__ import annotations

from collections import defaultdict

from .config import SLOT_MINUTES
from .reward import score_plan
from .schemas import PlanResult, Session, Situation


def build_plan_result(situation: Situation, assignments: list[int], source: str, inference_ms: float = 0.0) -> PlanResult:
    sessions: list[Session] = []
    learning_minutes: dict[str, int] = defaultdict(int)
    for index, slot in enumerate(situation.slots):
        action = assignments[index]
        exam = situation.exams[action - 1] if 0 < action <= len(situation.exams) else None
        exam_id = exam.id if exam else None
        subject = exam.subject if exam else "Pause / frei"
        kind = "study" if exam else "break"
        if sessions and sessions[-1].day == slot.day and sessions[-1].end_minute == slot.start_minute and sessions[-1].exam_id == exam_id:
            sessions[-1].end_minute = slot.end_minute
        else:
            sessions.append(Session(
                day=slot.day, start_minute=slot.start_minute, end_minute=slot.end_minute,
                exam_id=exam_id, subject=subject, kind=kind,
            ))
        if exam:
            learning_minutes[exam.id] += SLOT_MINUTES
    return PlanResult(
        assignments=assignments, sessions=sessions, reward=score_plan(situation, assignments),
        learning_minutes=dict(learning_minutes), inference_ms=inference_ms, source=source,
    )

