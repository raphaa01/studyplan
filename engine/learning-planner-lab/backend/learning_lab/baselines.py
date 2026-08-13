from __future__ import annotations

import random

from .plans import build_plan_result
from .reward import score_plan
from .schemas import PlanResult, Situation


def valid_actions(situation: Situation, slot_index: int) -> list[int]:
    day = situation.slots[slot_index].day
    return [0] + [i + 1 for i, exam in enumerate(situation.exams) if day < exam.days_until]


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
        action = min(candidates, key=lambda a: situation.exams[a - 1].days_until) if candidates else 0
        assignments.append(action)
    return build_plan_result(situation, assignments, "Earliest Deadline First")


def weighted_priority_scheduler(situation: Situation) -> PlanResult:
    assignments: list[int] = []
    minutes = [exam.invested_minutes for exam in situation.exams]
    for index in range(len(situation.slots)):
        candidates = valid_actions(situation, index)[1:]
        if not candidates:
            assignments.append(0)
            continue
        def priority(action: int) -> float:
            exam = situation.exams[action - 1]
            need = exam.estimated_need_minutes or 180
            saturation = max(0.15, 1.0 - minutes[action - 1] / max(need, 30))
            return (2.2 / (exam.days_until ** 0.55) + exam.difficulty / 10 + 1.2 * exam.importance / 10) * saturation
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


BASELINES = {
    "random": random_scheduler,
    "edf": earliest_deadline_scheduler,
    "weighted": weighted_priority_scheduler,
    "greedy": greedy_scheduler,
}
