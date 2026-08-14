from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .config import MAX_TARGETS, SLOT_MINUTES, TARGET_FEATURES, V3_GLOBAL_FEATURES
from .generator import SituationGenerator
from .reward import score_plan_v3
from .schemas import Situation
from .targets import method_profile, targets_for


@dataclass
class Observation:
    # Kept as ``exams`` for trainer/checkpoint API compatibility; rows are v3 planning targets.
    exams: np.ndarray
    global_features: np.ndarray
    action_mask: np.ndarray


class LearningPlanEnv:
    """Sequential target allocator. Action 0 is idle, 1..12 select a PlanningTarget."""

    def __init__(self, generator: SituationGenerator | None = None, curriculum_level: int = 1):
        self.generator = generator or SituationGenerator()
        self.curriculum_level = curriculum_level
        self.situation: Situation | None = None
        self.assignments: list[int] = []
        self.position = 0
        self.previous_score = 0.0

    def reset(self, situation: Situation | None = None, seed: int | None = None) -> Observation:
        self.situation = situation or self.generator.generate(self.curriculum_level, seed=seed)
        self.situation = self.situation.model_copy(update={"schema_version": "3.0"})
        if len(targets_for(self.situation)) > MAX_TARGETS:
            raise ValueError(f"at most {MAX_TARGETS} planning targets are supported")
        self.assignments = [0] * len(self.situation.slots)
        self.position = 0
        self.previous_score = score_plan_v3(self.situation, self.assignments).total
        return self.observe()

    def step(self, action: int) -> tuple[Observation | None, float, bool, dict[str, object]]:
        if self.situation is None or self.position >= len(self.situation.slots):
            raise RuntimeError("reset the environment before stepping")
        mask = self.action_mask()
        invalid = action < 0 or action >= len(mask) or not bool(mask[action])
        if invalid:
            action = 0
        self.assignments[self.position] = int(action)
        score = score_plan_v3(self.situation, self.assignments).total
        reward = score - self.previous_score + (-5.0 if invalid else 0.0)
        self.previous_score = score
        self.position += 1
        done = self.position >= len(self.situation.slots)
        info: dict[str, object] = {"invalid_action": invalid, "plan_reward": score}
        return (None if done else self.observe()), float(reward), done, info

    def _stats(self, target_index: int) -> tuple[list[int], set[int], set[int]]:
        assert self.situation is not None
        targets = targets_for(self.situation)
        target = targets[target_index]
        current_week = self.situation.slots[min(self.position, len(self.situation.slots) - 1)].day // 7
        indices = [i for i, action in enumerate(self.assignments[:self.position]) if action == target_index + 1 and self.situation.slots[i].day // 7 == current_week]
        days = {self.situation.slots[i].day for i in indices}
        credit_days: set[int] = set()
        if target.kind == "routine":
            for idx, other in enumerate(targets):
                if other.kind == "exam" and other.subject_id == target.subject_id:
                    credit_days.update(
                        self.situation.slots[i].day for i, action in enumerate(self.assignments[:self.position])
                        if action == idx + 1 and self.situation.slots[i].day // 7 == current_week
                    )
        return indices, days, credit_days

    def action_mask(self) -> np.ndarray:
        mask = np.zeros(MAX_TARGETS + 1, dtype=np.bool_)
        mask[0] = True
        if self.situation is None or self.position >= len(self.situation.slots):
            return mask
        targets = targets_for(self.situation)
        slot = self.situation.slots[self.position]
        locked = next((x for x in self.situation.locked_sessions if x.slot_index == self.position and x.status in ("completed", "started")), None)
        for index, target in enumerate(targets[:MAX_TARGETS]):
            allowed = target.deadline_day is None or slot.day < target.deadline_day
            if target.kind == "routine":
                routine = next(r for r in self.situation.routines if r.id == target.id)
                allowed = allowed and (routine.active_from_day is None or slot.day >= routine.active_from_day)
                allowed = allowed and (routine.active_until_day is None or slot.day <= routine.active_until_day)
                _, own_days, credit_days = self._stats(index)
                # Hard anti-overfill mask: never add general routine work after weekly credit is fulfilled.
                allowed = allowed and len(own_days | credit_days) < target.sessions_per_week
            if locked is not None:
                allowed = target.id == locked.target_id
            mask[index + 1] = allowed
        if locked is not None:
            mask[0] = locked.target_id is None
        return mask

    def observe(self) -> Observation:
        if self.situation is None:
            raise RuntimeError("environment has no active situation")
        situation = self.situation
        targets = targets_for(situation)
        slot = situation.slots[min(self.position, len(situation.slots) - 1)]
        features = np.zeros((MAX_TARGETS, TARGET_FEATURES), dtype=np.float32)
        mask = self.action_mask()
        previous_action = self.assignments[self.position - 1] if self.position else 0
        remaining_week_slots = sum(s.day // 7 == slot.day // 7 for s in situation.slots[self.position:])
        routine_deficit = 0
        exam_burden = 0.0

        for index, target in enumerate(targets[:MAX_TARGETS]):
            indices, own_days, credit_days = self._stats(index)
            assigned_minutes = len(indices) * SLOT_MINUTES
            fulfilled = min(target.sessions_per_week, len(own_days | credit_days)) if target.kind == "routine" else 0
            remaining_need = max(target.estimated_need_minutes - target.invested_minutes - assigned_minutes, 0)
            if target.kind == "routine":
                routine_deficit += max(target.sessions_per_week - fulfilled, 0)
            else:
                exam_burden += remaining_need
            last_day = situation.slots[indices[-1]].day if indices else None
            profile = method_profile(target.learning_method, kind=target.kind, days_until=target.deadline_day, difficulty=target.difficulty)
            feedback = target.feedback
            features[index] = np.asarray([
                1.0,
                1.0 if target.kind == "exam" else 0.0,
                1.0 if target.kind == "routine" else 0.0,
                1.0 if target.deadline_day is not None else 0.0,
                min((target.deadline_day or 0) / 30, 2),
                min(remaining_need / 900, 2),
                min((target.invested_minutes + assigned_minutes) / 900, 2),
                target.difficulty / 10,
                target.importance / 10,
                profile.desired_block_slots / 4,
                profile.spacing_preference,
                profile.interleaving_preference,
                profile.preferred_phase,
                profile.retrieval_intensity,
                target.sessions_per_week / 7,
                fulfilled / max(target.sessions_per_week, 1),
                min(remaining_week_slots / 28, 2),
                1.0 if last_day is None else min(max(slot.day - last_day, 0) / 7, 1),
                min(len(own_days | credit_days) / 7, 1),
                min(len(credit_days) / max(target.sessions_per_week, 1), 1),
                float(mask[index + 1]),
                feedback.difficulty if feedback else .5,
                feedback.confidence if feedback else .5,
                1.0 if target.flexible else 0.0,
            ], dtype=np.float32)

        studied = sum(action > 0 for action in self.assignments[:self.position])
        run_length = 0
        for action in reversed(self.assignments[:self.position]):
            if action <= 0:
                break
            run_length += 1
        same_day_indices = [i for i in range(self.position) if situation.slots[i].day == slot.day and self.assignments[i] > 0]
        previous_slot = situation.slots[self.position - 1] if self.position else None
        same_day = previous_slot is not None and previous_slot.day == slot.day
        contiguous = same_day and previous_slot.end_minute == slot.start_minute
        flexible = sum(target.flexible for target in targets)
        globals_ = np.asarray([
            (slot.day % 7) / 6,
            (slot.day % 7 + slot.start_minute / 1440) / 7,
            self.position / max(len(situation.slots), 1),
            remaining_week_slots / max(len(situation.slots), 1),
            min(routine_deficit / 12, 1),
            min(len(same_day_indices) / 6, 1.5),
            min(run_length / 6, 1.5),
            min(exam_burden / 1800, 2),
            flexible / max(len(targets), 1),
            1 - flexible / max(len(targets), 1),
            slot.start_minute / 1440,
            1.0 if previous_action == 0 else 0.0,
            self.curriculum_level / 5,
            len(targets) / MAX_TARGETS,
            min(studied / max(len(situation.slots), 1), 1),
            1.0 if contiguous else 0.0,
        ], dtype=np.float32)
        assert features.shape == (MAX_TARGETS, TARGET_FEATURES)
        assert globals_.shape == (V3_GLOBAL_FEATURES,)
        return Observation(exams=features, global_features=globals_, action_mask=mask)


def curriculum_level(step: int, total_steps: int) -> int:
    if total_steps <= 0:
        return 1
    return int(np.clip(int(5 * step / total_steps) + 1, 1, 5))
