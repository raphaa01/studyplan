from __future__ import annotations

import random

from .plans import build_plan_result
from .reward import score_plan
from .schemas import PlanResult, Situation
from .targets import targets_for


def valid_actions(situation: Situation, slot_index: int) -> list[int]:
    day = situation.slots[slot_index].day
    return [0] + [i + 1 for i, target in enumerate(targets_for(situation)) if target.deadline_day is None or day < target.deadline_day]


def random_scheduler(situation: Situation, seed: int = 0) -> PlanResult:
    rng = random.Random(seed)
    assignments = []
    for index in range(len(situation.slots)):
        actions = valid_actions(situation, index)
        assignments.append(rng.choice(actions if rng.random() < 0.86 else [0]))
    return build_plan_result(situation, assignments, "Random")


def earliest_deadline_scheduler(situation: Situation) -> PlanResult:
    assignments = []
    for index in range(len(situation.slots)):
        candidates = valid_actions(situation, index)[1:]
        targets = targets_for(situation)
        action = min(candidates, key=lambda a: targets[a - 1].deadline_day if targets[a - 1].deadline_day is not None else 10_000) if candidates else 0
        assignments.append(action)
    return build_plan_result(situation, assignments, "Earliest Deadline First")


def weighted_priority_scheduler(situation: Situation) -> PlanResult:
    assignments: list[int] = []
    targets = targets_for(situation)
    minutes = [target.invested_minutes for target in targets]
    for index in range(len(situation.slots)):
        candidates = valid_actions(situation, index)[1:]
        if not candidates:
            assignments.append(0)
            continue
        def priority(action: int) -> float:
            exam = targets[action - 1]
            need = exam.estimated_need_minutes or 180
            saturation = max(0.15, 1.0 - minutes[action - 1] / max(need, 30))
            urgency = 2.2 / ((exam.deadline_day or 60) ** .55) if exam.kind == "exam" else .18
            flexibility = .45 if exam.flexible else 1.0
            return (urgency + exam.difficulty / 10 + 1.2 * exam.importance / 10) * saturation * flexibility
        action = max(candidates, key=priority)
        assignments.append(action)
        minutes[action - 1] += 30
    return build_plan_result(situation, assignments, "Weighted Priority")


def greedy_scheduler(situation: Situation) -> PlanResult:
    assignments = [0] * len(situation.slots)
    current = score_plan(situation, assignments).total
    for index in range(len(situation.slots)):
        best_action = 0
        best_score = current
        for action in valid_actions(situation, index):
            candidate = assignments.copy()
            candidate[index] = action
            candidate_score = score_plan(situation, candidate).total
            if candidate_score > best_score + 1e-8:
                best_action, best_score = action, candidate_score
        assignments[index] = best_action
        current = best_score
    return build_plan_result(situation, assignments, "Greedy Marginal Utility")


def hybrid_scheduler(situation: Situation) -> PlanResult:
    """Exam-first baseline with same-subject credit and distributed routine fill."""
    targets = targets_for(situation)
    assignments = [0] * len(situation.slots)
    minutes = [target.invested_minutes for target in targets]
    routine_days: dict[str, set[int]] = {target.id: set() for target in targets if target.kind == "routine"}
    for index, slot in enumerate(situation.slots):
        candidates = valid_actions(situation, index)[1:]
        exams = [a for a in candidates if targets[a - 1].kind == "exam" and minutes[a - 1] < targets[a - 1].estimated_need_minutes]
        if exams:
            action = max(exams, key=lambda a: (targets[a - 1].importance + targets[a - 1].difficulty) / max(targets[a - 1].deadline_day or 1, 1))
        else:
            routines = [a for a in candidates if targets[a - 1].kind == "routine" and len(routine_days[targets[a - 1].id]) < targets[a - 1].sessions_per_week]
            routines = [a for a in routines if slot.day not in routine_days[targets[a - 1].id]]
            action = max(routines, key=lambda a: targets[a - 1].importance) if routines else 0
        assignments[index] = action
        if action:
            target = targets[action - 1]
            minutes[action - 1] += 30
            if target.kind == "routine":
                routine_days[target.id].add(slot.day)
            else:
                for routine in targets:
                    if routine.kind == "routine" and routine.subject_id == target.subject_id:
                        routine_days[routine.id].add(slot.day)
    return build_plan_result(situation, assignments, "Hybrid Exam + Routine")


BASELINES = {
    "random": random_scheduler,
    "edf": earliest_deadline_scheduler,
    "weighted": weighted_priority_scheduler,
    "greedy": greedy_scheduler,
    "hybrid": hybrid_scheduler,
}
