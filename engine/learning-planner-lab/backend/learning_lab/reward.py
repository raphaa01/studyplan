from __future__ import annotations

from collections import defaultdict
from math import ceil, exp, sqrt

import numpy as np

from .config import REWARD_VERSION, REWARD_WEIGHTS, RewardWeights, SLOT_MINUTES
from .schemas import Exam, RewardBreakdown, Situation


def _clip01(value: float) -> float:
    return float(np.clip(value, 0.0, 1.0))


def _weighted_mean(values: list[float], weights: list[float]) -> float:
    return float(np.average(values, weights=weights)) if values else 0.0


def _priority_weight(exam: Exam) -> float:
    """Bounded priority: relevant, but no single exam can dominate the plan."""
    importance = (exam.importance - 1) / 9.0
    difficulty = (exam.difficulty - 1) / 9.0
    urgency = 1.0 / sqrt(max(exam.days_until, 1))
    return 0.72 + 0.34 * importance + 0.22 * difficulty + 0.18 * urgency


def _daily_effective_minutes(minutes: int) -> float:
    """Within-day diminishing returns without declaring later study worthless."""
    first = min(minutes, 90)
    second = min(max(minutes - 90, 0), 30) * 0.60
    third = min(max(minutes - 120, 0), 60) * 0.30
    excess = max(minutes - 180, 0) * 0.08
    return first + second + third + excess


def _normalized_mastery(total_effective_minutes: float, need: float) -> float:
    """Saturating mastery that reaches its ceiling at the estimated need."""
    if need <= 0:
        return 1.0
    ratio = min(total_effective_minutes / max(need, SLOT_MINUTES), 1.0)
    scale = 2.25
    return _clip01((1.0 - exp(-scale * ratio)) / (1.0 - exp(-scale)))


def _spacing_quality(exam: Exam, daily_minutes: dict[int, int], remaining_need: float) -> float:
    if not daily_minutes:
        return 0.0
    days = sorted(day for day, minutes in daily_minutes.items() if minutes >= SLOT_MINUTES)
    target_days = min(max(1, ceil(max(remaining_need, SLOT_MINUTES) / 90.0)), min(exam.days_until, 5))
    distribution = min(len(days) / target_days, 1.0)
    if target_days == 1:
        return distribution
    if len(days) < 2:
        return 0.35 * distribution
    ideal_gap = max(1.0, exam.days_until / (target_days + 0.5))
    gaps = np.diff(days).astype(float)
    # Symmetric on a log scale: both massing and unnecessarily huge gaps lose value.
    gap_quality = float(np.mean(np.exp(-np.abs(np.log(np.maximum(gaps, 0.5) / ideal_gap)) * 0.65)))
    return _clip01(0.62 * distribution + 0.38 * gap_quality)


def _early_start_quality(exam: Exam, daily_minutes: dict[int, int]) -> float:
    if not daily_minutes:
        return 0.0
    first_day = min(daily_minutes)
    lead_fraction = (exam.days_until - first_day) / max(exam.days_until, 1)
    return _clip01(lead_fraction)


def _avoidable_cramming(situation: Situation, exam: Exam, indices: list[int]) -> float:
    if not indices:
        return 0.0
    late_days = max(1, min(3, ceil(exam.days_until * 0.20)))
    late_start = exam.days_until - late_days
    learned = len(indices) * SLOT_MINUTES
    late_minutes = sum(SLOT_MINUTES for index in indices if situation.slots[index].day >= late_start)
    early_opportunity = sum(
        SLOT_MINUTES for slot in situation.slots if slot.day < late_start and slot.day < exam.days_until
    )
    if early_opportunity <= 0:
        return 0.0
    avoidability = min(early_opportunity / max(learned, SLOT_MINUTES), 1.0)
    late_fraction = late_minutes / max(learned, SLOT_MINUTES)
    return _clip01((late_fraction ** 1.35) * avoidability)


def _sequence_quality(situation: Situation, assignments: list[int]) -> tuple[float, float]:
    """Return fatigue penalty and earned break quality for contiguous availability."""
    runs: list[int] = []
    useful_breaks = 0.0
    studied_slots = sum(action > 0 for action in assignments)
    run = 0
    for index, action in enumerate(assignments):
        new_day = index > 0 and situation.slots[index].day != situation.slots[index - 1].day
        disconnected = index > 0 and situation.slots[index - 1].end_minute != situation.slots[index].start_minute
        if new_day or disconnected:
            if run:
                runs.append(run)
            run = 0
        if action > 0:
            run += 1
        else:
            if run:
                runs.append(run)
                if 2 <= run <= 4 and index + 1 < len(assignments):
                    next_slot = situation.slots[index + 1]
                    if next_slot.day == situation.slots[index].day and assignments[index + 1] > 0:
                        useful_breaks += 1.0
            run = 0
    if run:
        runs.append(run)
    fatigue_load = sum((max(length - 3, 0) / 3.0) ** 1.45 for length in runs)
    fatigue = _clip01(fatigue_load / max(studied_slots / 3.0, 1.0))
    break_opportunities = sum(length >= 2 for length in runs) + useful_breaks
    break_quality = useful_breaks / max(break_opportunities, 1.0)
    return fatigue, _clip01(break_quality)


def _switching_penalty(situation: Situation, assignments: list[int]) -> float:
    """Penalize rapid context switching, not deliberate 60+ minute interleaving."""
    bad_switches = 0
    switches = 0
    run = 0
    previous_action = 0
    previous_day = -1
    for index, action in enumerate(assignments):
        day = situation.slots[index].day
        contiguous = (
            index > 0
            and day == previous_day
            and situation.slots[index - 1].end_minute == situation.slots[index].start_minute
        )
        if not contiguous or action == 0:
            run = 0
            previous_action = action
        elif previous_action > 0 and action != previous_action:
            switches += 1
            bad_switches += int(run < 2)
            run = 0
            previous_action = action
        if action > 0:
            run += 1
            previous_action = action
        previous_day = day
    return bad_switches / max(switches, 1)


def score_plan(
    situation: Situation,
    assignments: list[int],
    weights: RewardWeights = REWARD_WEIGHTS,
) -> RewardBreakdown:
    """Reward v2: opportunity-aware estimated learning utility.

    Idle time is neutral. Learning earns utility only while it improves estimated
    readiness; time beyond an uncertainty margin is explicit overlearning.
    Spacing is capped by a need-dependent target, and cramming is penalized only
    when earlier study opportunities actually existed.
    """
    if len(assignments) != len(situation.slots):
        return _invalid_breakdown(weights.invalid)

    exam_count = len(situation.exams)
    invalid_count = 0
    by_exam: dict[int, list[int]] = defaultdict(list)
    for slot_index, action in enumerate(assignments):
        if action < 0 or action > exam_count:
            invalid_count += 1
            continue
        if action > 0:
            exam = situation.exams[action - 1]
            if situation.slots[slot_index].day >= exam.days_until:
                invalid_count += 1
            else:
                by_exam[action - 1].append(slot_index)

    priorities: list[float] = []
    mastery_scores: list[float] = []
    deadline_scores: list[float] = []
    spacing_scores: list[float] = []
    early_scores: list[float] = []
    coverage_scores: list[float] = []
    cramming_scores: list[float] = []
    overlearning_scores: list[float] = []
    total_actual = 0.0
    total_meaningful = 0.0
    total_remaining_need = 0.0
    per_exam: dict[str, float] = {}

    for exam_index, exam in enumerate(situation.exams):
        indices = by_exam.get(exam_index, [])
        actual = float(len(indices) * SLOT_MINUTES)
        need = float(exam.estimated_need_minutes or (45 + 28 * exam.difficulty + 18 * exam.importance))
        prior = min(float(exam.invested_minutes), need)
        remaining_need = max(need - prior, 0.0)
        daily: dict[int, int] = defaultdict(int)
        for index in indices:
            daily[situation.slots[index].day] += SLOT_MINUTES
        effective_new = sum(_daily_effective_minutes(minutes) for minutes in daily.values())
        meaningful_new = min(effective_new, remaining_need)
        mastery = _normalized_mastery(prior + meaningful_new, need)
        spacing = _spacing_quality(exam, dict(daily), remaining_need)
        early = _early_start_quality(exam, dict(daily))
        cramming = _avoidable_cramming(situation, exam, indices)

        coverage_target = min(max(remaining_need * 0.25, SLOT_MINUTES), 90.0) if remaining_need > 0 else 0.0
        coverage = 1.0 if remaining_need <= 0 else min(actual / coverage_target, 1.0)
        safe_cap = remaining_need * 1.10 + (SLOT_MINUTES if remaining_need > 0 else 0.0)
        excess = max(actual - safe_cap, 0.0)
        overlearning = min((excess / max(remaining_need, 60.0)) ** 1.25, 4.0)
        urgency = 1.0 / sqrt(max(exam.days_until, 1))
        deadline_readiness = mastery * (0.78 + 0.22 * urgency)
        priority = _priority_weight(exam)

        priorities.append(priority)
        mastery_scores.append(mastery)
        deadline_scores.append(deadline_readiness)
        spacing_scores.append(spacing)
        early_scores.append(early)
        coverage_scores.append(coverage)
        cramming_scores.append(cramming)
        overlearning_scores.append(overlearning)
        total_actual += actual
        total_meaningful += meaningful_new
        total_remaining_need += remaining_need
        per_exam[exam.id] = round(mastery * 100.0, 3)

    preparation = _weighted_mean(mastery_scores, priorities)
    deficit_rms = sqrt(_weighted_mean([(1.0 - score) ** 2 for score in mastery_scores], priorities))
    fairness = _clip01(1.0 - deficit_rms)
    coverage = float(np.mean(coverage_scores)) if coverage_scores else 0.0
    waste_ratio = max(total_actual - total_meaningful, 0.0) / max(total_actual, SLOT_MINUTES)
    global_excess = max(total_actual - (total_remaining_need * 1.10 + SLOT_MINUTES), 0.0)
    global_overlearning = min((global_excess / max(total_remaining_need, 90.0)) ** 1.20, 4.0)
    overlearning = 0.72 * _weighted_mean(overlearning_scores, priorities) + 0.28 * global_overlearning
    fatigue, break_quality = _sequence_quality(situation, assignments)
    switching = _switching_penalty(situation, assignments)
    # A break bonus is earned only in a plan containing meaningful preparation.
    meaningful_fraction = min(total_meaningful / max(total_remaining_need, SLOT_MINUTES), 1.0)
    break_quality *= meaningful_fraction

    components = {
        "preparation": weights.preparation * preparation,
        "deadline": weights.deadline * _weighted_mean(deadline_scores, priorities),
        "spacing": weights.spacing * _weighted_mean(spacing_scores, priorities),
        "early_start": weights.early_start * _weighted_mean(early_scores, priorities),
        "coverage": weights.coverage * coverage,
        "fairness": weights.fairness * fairness,
        "utilization": weights.utilization * waste_ratio,
        "overlearning": weights.overlearning * overlearning,
        "fatigue": weights.fatigue * fatigue,
        "switching": weights.switching * switching,
        "break_quality": weights.break_quality * break_quality,
        "cramming": weights.cramming * _weighted_mean(cramming_scores, priorities),
        "invalid": weights.invalid * invalid_count,
    }
    total = float(sum(components.values()))
    return RewardBreakdown(
        reward_version=REWARD_VERSION,
        total=total,
        per_exam=per_exam,
        **components,
    )


def _invalid_breakdown(invalid: float) -> RewardBreakdown:
    return RewardBreakdown(
        reward_version=REWARD_VERSION,
        total=invalid,
        preparation=0,
        deadline=0,
        spacing=0,
        early_start=0,
        coverage=0,
        fairness=0,
        utilization=0,
        overlearning=0,
        fatigue=0,
        switching=0,
        break_quality=0,
        cramming=0,
        invalid=invalid,
    )
