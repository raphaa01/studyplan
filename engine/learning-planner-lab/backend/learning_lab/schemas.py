from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


ExamType = Literal["test", "exam"]
LearningMethod = Literal[
    "auto", "pomodoro", "spaced_repetition", "interleaving",
    "active_recall", "exam_simulation",
]


class LearningFeedback(BaseModel):
    difficulty: float = Field(default=0.5, ge=0, le=1)
    confidence: float = Field(default=0.5, ge=0, le=1)
    completion_rate: float = Field(default=1.0, ge=0, le=1)
    missed_sessions: int = Field(default=0, ge=0, le=20)
    planned_minutes: int = Field(default=0, ge=0, le=10000)
    actual_minutes: int = Field(default=0, ge=0, le=10000)
    days_since_success: int | None = Field(default=None, ge=0, le=365)


class Exam(BaseModel):
    id: str
    subject: str
    subject_id: str | None = None
    kind: ExamType = "test"
    days_until: int = Field(ge=1, le=60)
    difficulty: int = Field(ge=1, le=10)
    importance: int = Field(ge=1, le=10)
    invested_minutes: int = Field(default=0, ge=0, le=10000)
    estimated_need_minutes: int | None = Field(default=None, ge=30, le=10000)
    learning_method: LearningMethod = "auto"
    feedback: LearningFeedback | None = None


class LearningRoutine(BaseModel):
    id: str
    subject: str
    subject_id: str | None = None
    title: str
    sessions_per_week: int = Field(default=1, ge=1, le=7)
    preferred_session_minutes: int = Field(default=30, ge=25, le=180)
    importance: int = Field(default=5, ge=1, le=10)
    difficulty: int = Field(default=5, ge=1, le=10)
    learning_method: LearningMethod = "auto"
    topics: list[str] = Field(default_factory=list)
    preferred_weekdays: list[int] = Field(default_factory=list)
    active_from_day: int | None = Field(default=None, ge=0, le=365)
    active_until_day: int | None = Field(default=None, ge=0, le=365)
    flexible: bool = True
    enabled: bool = True
    feedback: LearningFeedback | None = None


class PlanningTarget(BaseModel):
    id: str
    kind: Literal["exam", "routine"]
    subject_id: str
    subject: str
    difficulty: int
    importance: int
    learning_method: LearningMethod
    deadline_day: int | None = None
    estimated_need_minutes: int
    invested_minutes: int = 0
    sessions_per_week: int = 0
    preferred_session_minutes: int = 30
    flexible: bool = False
    preferred_weekdays: list[int] = Field(default_factory=list)
    feedback: LearningFeedback | None = None


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


class LockedSession(BaseModel):
    slot_index: int
    target_id: str | None = None
    status: Literal["completed", "started", "planned", "missed"] = "planned"


class Situation(BaseModel):
    id: str
    exams: list[Exam] = Field(default_factory=list)
    routines: list[LearningRoutine] = Field(default_factory=list)
    windows: list[TimeWindow]
    slots: list[StudySlot]
    curriculum_level: int = Field(ge=1, le=5)
    seed: int
    schema_version: str = "2.0"
    locked_sessions: list[LockedSession] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_situation(self) -> "Situation":
        if not self.exams and not self.routines:
            raise ValueError("a situation needs at least one planning target")
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
    exam_id: str | None = None
    routine_id: str | None = None
    routine_credit_ids: list[str] = Field(default_factory=list)
    target_id: str | None = None
    subject: str
    kind: Literal["study", "break"]
    learning_method: LearningMethod | None = None


class RewardBreakdown(BaseModel):
    reward_version: str = "3.0"
    total: float
    preparation: float = 0.0
    deadline: float = 0.0
    spacing: float = 0.0
    early_start: float = 0.0
    coverage: float = 0.0
    fairness: float = 0.0
    utilization: float = 0.0
    overlearning: float = 0.0
    fatigue: float = 0.0
    switching: float = 0.0
    break_quality: float = 0.0
    cramming: float = 0.0
    invalid: float = 0.0
    routine_fulfillment: float = 0.0
    routine_overfill: float = 0.0
    routine_distribution: float = 0.0
    exam_substitution_credit: float = 0.0
    duplicate_work: float = 0.0
    method_adherence: float = 0.0
    plan_stability: float = 0.0
    per_exam: dict[str, float] = Field(default_factory=dict)
    per_routine: dict[str, float] = Field(default_factory=dict)


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
    subject_id: str | None = None
    kind: ExamType
    date: date
    difficulty: int = Field(ge=1, le=10)
    importance: int = Field(ge=1, le=10)
    invested_minutes: int = Field(default=0, ge=0)
    estimated_need_minutes: int | None = Field(default=None, ge=30)
    learning_method: LearningMethod = "auto"
    feedback: LearningFeedback | None = None


class PlaygroundRequest(BaseModel):
    exams: list[PlaygroundExam] = Field(default_factory=list)
    routines: list[LearningRoutine] = Field(default_factory=list)
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
    init_mode: Literal["scratch", "compatible_transfer"] = "scratch"
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
