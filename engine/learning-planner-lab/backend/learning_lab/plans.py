from __future__ import annotations

from collections import defaultdict

from .config import SLOT_MINUTES
from .reward import score_plan
from .schemas import PlanResult, Session, Situation
from .targets import exam_credit_routines, targets_for


def build_plan_result(situation: Situation, assignments: list[int], source: str, inference_ms: float = 0.0) -> PlanResult:
    sessions: list[Session] = []
    learning_minutes: dict[str, int] = defaultdict(int)
    targets = targets_for(situation)
    for index, slot in enumerate(situation.slots):
        action = assignments[index]
        target = targets[action - 1] if 0 < action <= len(targets) else None
        exam = next((e for e in situation.exams if target and target.kind == "exam" and e.id == target.id), None)
        routine = next((r for r in situation.routines if target and target.kind == "routine" and r.id == target.id), None)
        exam_id = exam.id if exam else None
        routine_id = routine.id if routine else None
        credit_ids = [r.id for r in exam_credit_routines(situation, exam)] if exam else []
        subject = target.subject if target else "Pause / frei"
        kind = "study" if target else "break"
        if sessions and sessions[-1].day == slot.day and sessions[-1].end_minute == slot.start_minute and sessions[-1].target_id == (target.id if target else None):
            sessions[-1].end_minute = slot.end_minute
        else:
            sessions.append(Session(
                day=slot.day, start_minute=slot.start_minute, end_minute=slot.end_minute,
                exam_id=exam_id, routine_id=routine_id, routine_credit_ids=credit_ids,
                target_id=target.id if target else None, subject=subject, kind=kind,
                learning_method=target.learning_method if target else None,
            ))
        if target:
            learning_minutes[target.id] += SLOT_MINUTES
    return PlanResult(
        assignments=assignments, sessions=sessions, reward=score_plan(situation, assignments),
        learning_minutes=dict(learning_minutes), inference_ms=inference_ms, source=source,
    )

