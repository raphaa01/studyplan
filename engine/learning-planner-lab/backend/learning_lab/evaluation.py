from __future__ import annotations

from collections import defaultdict
from statistics import fmean

from .baselines import BASELINES
from .model import PlannerActorCritic, generate_plan
from .schemas import Situation


def _quality_metrics(result) -> dict[str, float]:
    reward = result.reward
    studied = sum(session.end_minute - session.start_minute for session in result.sessions if session.kind == "study")
    available = sum(session.end_minute - session.start_minute for session in result.sessions)
    return {
        "exam_readiness": fmean(reward.per_exam.values()) if reward.per_exam else 100.0,
        "routine_fulfillment": fmean(reward.per_routine.values()) if reward.per_routine else 100.0,
        "unnecessary_routine_units": abs(reward.routine_overfill),
        "double_counts": abs(reward.duplicate_work),
        "method_adherence": max(reward.method_adherence, 0.0),
        "spacing": max(reward.spacing, 0.0),
        "fatigue": abs(reward.fatigue),
        "cramming": abs(reward.cramming),
        "idle_ratio": 1 - studied / max(available, 1),
        "fairness": max(reward.fairness, 0.0),
        "inference_ms": result.inference_ms,
    }


def evaluate_model(model: PlannerActorCritic, situations: list[Situation]) -> dict[str, object]:
    rewards: list[float] = []
    inference_times: list[float] = []
    buckets: dict[str, list[float]] = defaultdict(list)
    metrics: dict[str, list[float]] = defaultdict(list)
    for situation in situations:
        result = generate_plan(model, situation)
        rewards.append(result.reward.total)
        inference_times.append(result.inference_ms)
        count = len(situation.exams)
        bucket = "1-2" if count <= 2 else "3-4" if count <= 4 else "5-6" if count <= 6 else "7-8"
        buckets[bucket].append(result.reward.total)
        for key, value in _quality_metrics(result).items():
            metrics[key].append(value)
    return {
        "mean_reward": fmean(rewards) if rewards else 0.0,
        "median_reward": sorted(rewards)[len(rewards) // 2] if rewards else 0.0,
        "mean_inference_ms": fmean(inference_times) if inference_times else 0.0,
        "by_exam_count": {key: fmean(values) for key, values in buckets.items()},
        "sample_count": len(situations),
        "metrics": {key: fmean(values) for key, values in metrics.items()},
    }


def evaluate_baselines(situations: list[Situation], include_random: bool = True) -> dict[str, dict[str, object]]:
    output: dict[str, dict[str, object]] = {}
    for name, scheduler in BASELINES.items():
        if name == "random" and not include_random:
            continue
        rewards: list[float] = []
        buckets: dict[str, list[float]] = defaultdict(list)
        for index, situation in enumerate(situations):
            result = scheduler(situation, seed=situation.seed + index) if name == "random" else scheduler(situation)
            rewards.append(result.reward.total)
            count = len(situation.exams)
            bucket = "1-2" if count <= 2 else "3-4" if count <= 4 else "5-6" if count <= 6 else "7-8"
            buckets[bucket].append(result.reward.total)
        output[name] = {
            "mean_reward": fmean(rewards) if rewards else 0.0,
            "by_exam_count": {key: fmean(values) for key, values in buckets.items()},
            "sample_count": len(situations),
        }
    return output


HOLDOUT_GROUPS = [
    "exam_only", "routine_only", "same_subject_credit", "scarcity", "competing_exams",
    "learning_methods", "feedback_replanning", "week_boundary", "no_double_count", "fatigue_breaks",
]


def evaluate_grouped(model: PlannerActorCritic, generator, samples_per_group: int = 16, seed: int = 20260814) -> dict[str, object]:
    groups: dict[str, object] = {}
    for group_index, group in enumerate(HOLDOUT_GROUPS):
        scenarios = [generator.generate_group(group, seed + group_index * 1000 + i) for i in range(samples_per_group)]
        groups[group] = evaluate_model(model, scenarios)
    return {"schema_version": "3.0", "reward_version": "3.0", "groups": groups}

