from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .config import EXAM_FEATURES, GLOBAL_FEATURES, MAX_EXAMS, SLOT_MINUTES
from .generator import SituationGenerator
from .reward import score_plan
from .schemas import Situation


@dataclass
class Observation:
    exams: np.ndarray
    global_features: np.ndarray
    action_mask: np.ndarray


class LearningPlanEnv:
    """Sequential slot-allocation environment with dense reward deltas."""

    def __init__(self, generator: SituationGenerator | None = None, curriculum_level: int = 1):
        self.generator = generator or SituationGenerator()
        self.curriculum_level = curriculum_level
        self.situation: Situation | None = None
        self.assignments: list[int] = []
        self.position = 0
        self.previous_score = 0.0

    def reset(self, situation: Situation | None = None, seed: int | None = None) -> Observation:
        self.situation = situation or self.generator.generate(self.curriculum_level, seed=seed)
        self.assignments = [0] * len(self.situation.slots)
        self.position = 0
        self.previous_score = score_plan(self.situation, self.assignments).total
        return self.observe()

    def step(self, action: int) -> tuple[Observation | None, float, bool, dict[str, object]]:
        if self.situation is None or self.position >= len(self.situation.slots):
            raise RuntimeError("reset the environment before stepping")
        mask = self.action_mask()
        invalid = action < 0 or action >= len(mask) or not bool(mask[action])
        if invalid:
            action = 0
        self.assignments[self.position] = int(action)
        score = score_plan(self.situation, self.assignments).total
        reward = score - self.previous_score + (-5.0 if invalid else 0.0)
        self.previous_score = score
        self.position += 1
        done = self.position >= len(self.situation.slots)
        info: dict[str, object] = {"invalid_action": invalid, "plan_reward": score}
        return (None if done else self.observe()), float(reward), done, info

    def action_mask(self) -> np.ndarray:
        mask = np.zeros(MAX_EXAMS + 1, dtype=np.bool_)
        mask[0] = True
        if self.situation is None or self.position >= len(self.situation.slots):
            return mask
        day = self.situation.slots[self.position].day
        for index, exam in enumerate(self.situation.exams[:MAX_EXAMS]):
            mask[index + 1] = day < exam.days_until
        return mask

    def observe(self) -> Observation:
        if self.situation is None:
            raise RuntimeError("environment has no active situation")
        situation = self.situation
        slot = situation.slots[min(self.position, len(situation.slots) - 1)]
        exam_features = np.zeros((MAX_EXAMS, EXAM_FEATURES), dtype=np.float32)
        previous_action = self.assignments[self.position - 1] if self.position > 0 else 0
        for index, exam in enumerate(situation.exams[:MAX_EXAMS]):
            assigned_indices = [i for i, action in enumerate(self.assignments[:self.position]) if action == index + 1]
            assigned_minutes = len(assigned_indices) * SLOT_MINUTES
            need = float(exam.estimated_need_minutes or 240)
            study_days = {situation.slots[i].day for i in assigned_indices}
            last_day = situation.slots[assigned_indices[-1]].day if assigned_indices else -1
            exam_features[index] = np.asarray([
                exam.difficulty / 10.0,
                exam.importance / 10.0,
                min(exam.days_until / 30.0, 2.0),
                1.0 if exam.kind == "exam" else 0.0,
                min(exam.invested_minutes / max(need, 30.0), 2.0),
                min(assigned_minutes / max(need, 30.0), 2.0),
                max(0.0, 1.0 - (exam.invested_minutes + assigned_minutes) / max(need, 30.0)),
                min(len(study_days) / 5.0, 1.0),
                1.0 if previous_action == index + 1 else 0.0,
                min(max(slot.day - last_day, 0) / 7.0, 1.0) if last_day >= 0 else 1.0,
                1.0 if slot.day < exam.days_until else 0.0,
            ], dtype=np.float32)

        studied = sum(action > 0 for action in self.assignments[:self.position])
        run_length = 0
        for action in reversed(self.assignments[:self.position]):
            if action <= 0:
                break
            run_length += 1
        previous_slot = situation.slots[self.position - 1] if self.position > 0 else None
        same_day = previous_slot is not None and previous_slot.day == slot.day
        contiguous = same_day and previous_slot.end_minute == slot.start_minute
        total_need = sum(exam.estimated_need_minutes or 240 for exam in situation.exams)
        global_features = np.asarray([
            min(slot.day / 30.0, 2.0),
            slot.start_minute / (24.0 * 60.0),
            self.position / max(len(situation.slots), 1),
            (len(situation.slots) - self.position) / max(len(situation.slots), 1),
            min(run_length / 6.0, 1.5),
            1.0 if previous_action == 0 else 0.0,
            self.curriculum_level / 5.0,
            len(situation.exams) / MAX_EXAMS,
            min(studied * SLOT_MINUTES / max(total_need, 30), 2.0),
            1.0 if same_day else 0.0,
            1.0 if contiguous else 0.0,
            1.0,
        ], dtype=np.float32)
        return Observation(exams=exam_features, global_features=global_features, action_mask=self.action_mask())


def curriculum_level(step: int, total_steps: int) -> int:
    if total_steps <= 0:
        return 1
    return int(np.clip(int(5 * step / total_steps) + 1, 1, 5))

