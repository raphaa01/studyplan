from __future__ import annotations

from collections import defaultdict
from statistics import fmean

from .baselines import BASELINES
from .model import PlannerActorCritic, generate_plan
from .schemas import Situation


def evaluate_model(model: PlannerActorCritic, situations: list[Situation]) -> dict[str, object]:
    rewards: list[float] = []
    inference_times: list[float] = []
    buckets: dict[str, list[float]] = defaultdict(list)
    for situation in situations:
        result = generate_plan(model, situation)
        rewards.append(result.reward.total)
        inference_times.append(result.inference_ms)
        count = len(situation.exams)
        bucket = "1-2" if count <= 2 else "3-4" if count <= 4 else "5-6" if count <= 6 else "7-8"
        buckets[bucket].append(result.reward.total)
    return {
        "mean_reward": fmean(rewards) if rewards else 0.0,
        "median_reward": sorted(rewards)[len(rewards) // 2] if rewards else 0.0,
        "mean_inference_ms": fmean(inference_times) if inference_times else 0.0,
        "by_exam_count": {key: fmean(values) for key, values in buckets.items()},
        "sample_count": len(situations),
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

