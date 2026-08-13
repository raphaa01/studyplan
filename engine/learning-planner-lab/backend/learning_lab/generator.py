from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np

from .config import EVALUATION_FILE, EVALUATION_SEED, EVALUATION_SIZE, MAX_EXAMS, SLOT_MINUTES
from .schemas import Exam, Situation, StudySlot, TimeWindow


SUBJECTS = [
    "Mathematik", "Deutsch", "Englisch", "Geschichte", "Biologie",
    "Chemie", "Physik", "Geografie", "Informatik", "Politik",
]


class SituationGenerator:
    """Fast in-memory scenario generator with a five-stage curriculum."""

    def __init__(self, seed: int | None = None):
        self.rng = np.random.default_rng(seed)

    def generate(self, level: int = 5, seed: int | None = None) -> Situation:
        rng = np.random.default_rng(seed) if seed is not None else self.rng
        level = int(np.clip(level, 1, 5))
        exam_ranges = {1: (1, 2), 2: (2, 3), 3: (3, 5), 4: (4, 6), 5: (1, MAX_EXAMS)}
        low, high = exam_ranges[level]
        exam_count = int(rng.integers(low, high + 1))

        if level <= 2:
            horizon = int(rng.integers(4, 11))
        elif level <= 4:
            horizon = int(rng.integers(7, 22))
        else:
            horizon = int(rng.integers(3, 31))

        deadline_pool = np.arange(1, horizon + 1)
        replace = exam_count > len(deadline_pool)
        deadlines = np.sort(rng.choice(deadline_pool, size=exam_count, replace=replace))
        exams: list[Exam] = []
        subjects = list(rng.choice(SUBJECTS, size=exam_count, replace=False if exam_count <= len(SUBJECTS) else True))
        for index, deadline in enumerate(deadlines):
            difficulty = int(rng.integers(2 if level == 1 else 1, 9 if level < 3 else 11))
            importance = int(rng.integers(2 if level == 1 else 1, 9 if level < 4 else 11))
            kind = "exam" if rng.random() < (0.25 + 0.08 * level) else "test"
            base_need = 45 + 28 * difficulty + 18 * importance + (90 if kind == "exam" else 0)
            need = int(np.clip(base_need * rng.uniform(0.75, 1.3), 60, 900) // 30 * 30)
            invested = int(rng.choice([0, 0, 0, 30, 60, 90])) if level >= 3 else 0
            exams.append(Exam(
                id=f"exam-{index + 1}", subject=subjects[index], kind=kind,
                days_until=int(deadline), difficulty=difficulty, importance=importance,
                invested_minutes=invested, estimated_need_minutes=need,
            ))

        windows: list[TimeWindow] = []
        max_day = max(e.days_until for e in exams)
        scarcity = {1: 0.78, 2: 0.72, 3: 0.58, 4: 0.52, 5: float(rng.uniform(0.35, 0.8))}[level]
        for day in range(max_day):
            weekday = day % 7
            weekend = weekday in (5, 6)
            if rng.random() > scarcity:
                continue
            count = 1 + int(level >= 4 and rng.random() < 0.22)
            used: list[tuple[int, int]] = []
            for _ in range(count):
                if weekend:
                    start = int(rng.integers(9 * 2, 17 * 2)) * 30
                    duration = int(rng.integers(2, 8)) * 30
                else:
                    start = int(rng.integers(14 * 2, 20 * 2)) * 30
                    duration = int(rng.integers(2, 6)) * 30
                end = min(start + duration, 21 * 60)
                if end - start < SLOT_MINUTES or any(not (end <= a or start >= b) for a, b in used):
                    continue
                used.append((start, end))
                windows.append(TimeWindow(day=day, start_minute=start, end_minute=end))

        if not windows:
            windows.append(TimeWindow(day=0, start_minute=16 * 60, end_minute=18 * 60))
        windows.sort(key=lambda w: (w.day, w.start_minute))
        slots = windows_to_slots(windows)
        situation_seed = int(seed if seed is not None else rng.integers(0, 2**31 - 1))
        digest = hashlib.sha1(json.dumps({"s": situation_seed, "e": exam_count, "h": horizon}).encode()).hexdigest()[:12]
        return Situation(
            id=f"s-{digest}", exams=exams, windows=windows, slots=slots,
            curriculum_level=level, seed=situation_seed,
        )


def windows_to_slots(windows: list[TimeWindow]) -> list[StudySlot]:
    slots: list[StudySlot] = []
    seen: set[tuple[int, int]] = set()
    for window in sorted(windows, key=lambda w: (w.day, w.start_minute)):
        cursor = window.start_minute
        while cursor + SLOT_MINUTES <= window.end_minute:
            key = (window.day, cursor)
            if key not in seen:
                slots.append(StudySlot(index=len(slots), day=window.day, start_minute=cursor, end_minute=cursor + SLOT_MINUTES))
                seen.add(key)
            cursor += SLOT_MINUTES
    slots.sort(key=lambda slot: (slot.day, slot.start_minute))
    for index, slot in enumerate(slots):
        slot.index = index
    return slots


def ensure_evaluation_set(path: Path = EVALUATION_FILE, size: int = EVALUATION_SIZE) -> list[Situation]:
    if path.exists():
        return [Situation.model_validate(item) for item in json.loads(path.read_text(encoding="utf-8"))]
    path.parent.mkdir(parents=True, exist_ok=True)
    generator = SituationGenerator(EVALUATION_SEED)
    situations = [generator.generate(level=5, seed=EVALUATION_SEED + i) for i in range(size)]
    path.write_text(json.dumps([item.model_dump(mode="json") for item in situations], ensure_ascii=False), encoding="utf-8")
    return situations

