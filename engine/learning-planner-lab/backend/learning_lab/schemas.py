from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


ExamType = Literal["test", "exam"]


class Exam(BaseModel):
    id: str
    subject: str
    kind: ExamType = "test"
    days_until: int = Field(ge=1, le=60)
    difficulty: int = Field(ge=1, le=10)
    importance: int = Field(ge=1, le=10)
    invested_minutes: int = Field(default=0, ge=0, le=10000)
    estimated_need_minutes: int | None = Field(default=None, ge=30, le=10000)


class TimeWindow(BaseModel):
    day: int = Field(ge=0, le=59)
    start_minute: int = Field(ge=0, lt=24 * 60)
    end_minute: int = Field(gt=0, le=24 * 60)

    @model_validator(mode="after")
    def validate_window(self) -> "TimeWindow":
        if self.end_minute <= self.start_minute:
            raise ValueError("end_minute must be after start_minute")
        return self


class StudySlot(BaseModel):
    index: int
    day: int
    start_minute: int
    end_minute: int


class Situation(BaseModel):
    id: str
    exams: list[Exam]
    windows: list[TimeWindow]
    slots: list[StudySlot]
    curriculum_level: int = Field(ge=1, le=5)
    seed: int

    @model_validator(mode="after")
    def validate_situation(self) -> "Situation":
        if not self.exams:
            raise ValueError("a situation needs at least one exam")
        occupied: set[tuple[int, int]] = set()
        for slot in self.slots:
            key = (slot.day, slot.start_minute)
            if key in occupied:
                raise ValueError("study slots overlap")
            occupied.add(key)
        return self


class Session(BaseModel):
    day: int
    start_minute: int
    end_minute: int
    exam_id: str | None
    subject: str
    kind: Literal["study", "break"]


class RewardBreakdown(BaseModel):
    reward_version: str = "2.0"
    total: float
    preparation: float
    deadline: float
    spacing: float
    early_start: float
    coverage: float
    fairness: float = 0.0
    utilization: float
    overlearning: float = 0.0
    fatigue: float
    switching: float
    break_quality: float
    cramming: float
    invalid: float = 0.0
    per_exam: dict[str, float] = Field(default_factory=dict)


class PlanResult(BaseModel):
    assignments: list[int]
    sessions: list[Session]
    reward: RewardBreakdown
    learning_minutes: dict[str, int]
    inference_ms: float
    source: str


class PlaygroundExam(BaseModel):
    id: str
    subject: str
    kind: ExamType
    date: date
    difficulty: int = Field(ge=1, le=10)
    importance: int = Field(ge=1, le=10)
    invested_minutes: int = Field(default=0, ge=0)
    estimated_need_minutes: int | None = Field(default=None, ge=30)


class PlaygroundRequest(BaseModel):
    exams: list[PlaygroundExam]
    windows: list[TimeWindow]
    model_id: str | None = None
    compare_baselines: bool = True
    seed: int = 42


class TrainingConfig(BaseModel):
    preset: Literal["quick", "short", "medium", "long", "very_long", "custom"] = "quick"
    total_steps: int = Field(default=5000, ge=128, le=100_000_000)
    max_episodes: int | None = Field(default=None, ge=1, le=10_000_000)
    rollout_steps: int = Field(default=128, ge=16, le=4096)
    parallel_envs: int = Field(default=4, ge=1, le=64)
    batch_size: int = Field(default=128, ge=16, le=8192)
    learning_rate: float = Field(default=3e-4, gt=0, le=0.1)
    gamma: float = Field(default=0.99, ge=0.8, le=1.0)
    gae_lambda: float = Field(default=0.95, ge=0.8, le=1.0)
    clip_range: float = Field(default=0.2, gt=0, le=0.5)
    entropy_coef: float = Field(default=0.02, ge=0, le=1)
    value_coef: float = Field(default=0.5, ge=0, le=2)
    epochs: int = Field(default=4, ge=1, le=30)
    max_grad_norm: float = Field(default=0.5, gt=0, le=10)
    seed: int = 42
    curriculum: bool = True
    parent_model: str | None = None
    checkpoint_interval: int = Field(default=5000, ge=128)
    validation_size: int = Field(default=64, ge=16, le=256)
    adaptive_learning_rate: bool = True
    min_learning_rate: float = Field(default=1e-5, gt=0, le=0.01)


class TrainingCommand(BaseModel):
    config: TrainingConfig


class RenameModelRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class TrainingStatus(BaseModel):
    state: Literal["idle", "running", "paused", "stopping", "completed", "failed"] = "idle"
    run_id: str | None = None
    started_at: datetime | None = None
    message: str = ""
    steps: int = 0
    total_steps: int = 0
    episodes: int = 0
    reward: float = 0.0
    moving_reward: float = 0.0
    evaluation_reward: float | None = None
    best_evaluation_reward: float | None = None
    best_step: int = 0
    loss: float = 0.0
    policy_loss: float = 0.0
    value_loss: float = 0.0
    entropy: float = 0.0
    learning_rate: float = 0.0
    steps_per_second: float = 0.0
    episodes_per_second: float = 0.0
    cpu_percent: float = 0.0
    ram_percent: float = 0.0
    threads: int = 0
    curriculum_level: int = 1
    model_size_bytes: int = 0
    history: list[dict[str, float | int | None]] = Field(default_factory=list)
