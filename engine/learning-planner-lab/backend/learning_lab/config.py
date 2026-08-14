from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
MODELS_DIR = ROOT / "models"
RUNS_DIR = ROOT / "runs"
SCHEMA_VERSION = "3.0"
EVALUATION_FILE = DATA_DIR / f"evaluation_set-schema-{SCHEMA_VERSION}-reward-3.0.json"
REGISTRY_FILE = DATA_DIR / "registry.json"

MAX_EXAMS = 8
EXAM_FEATURES = 11
GLOBAL_FEATURES = 12
MAX_TARGETS = 12
TARGET_FEATURES = 24
TARGET_PRESENT_INDEX = 0
V3_GLOBAL_FEATURES = 16
SLOT_MINUTES = 30
EVALUATION_SEED = 20260314
EVALUATION_SIZE = 1000
VALIDATION_SEED = 20260401
REWARD_VERSION = "3.0"
LEGACY_REWARD_VERSION = "2.0"


@dataclass(frozen=True)
class RewardWeights:
    preparation: float = 43.0
    deadline: float = 8.0
    spacing: float = 9.0
    early_start: float = 3.0
    coverage: float = 12.0
    fairness: float = 13.0
    utilization: float = -10.0
    overlearning: float = -22.0
    fatigue: float = -8.0
    switching: float = -3.0
    break_quality: float = 2.5
    cramming: float = -8.0
    invalid: float = -100.0

    def to_dict(self) -> dict[str, float]:
        return asdict(self)


REWARD_WEIGHTS = RewardWeights()


@dataclass(frozen=True)
class RewardV3Weights:
    # Exam readiness deliberately dominates optional routine utility.
    preparation: float = 48.0
    deadline: float = 12.0
    spacing: float = 8.0
    early_start: float = 3.0
    coverage: float = 12.0
    fairness: float = 10.0
    utilization: float = -9.0
    overlearning: float = -22.0
    fatigue: float = -9.0
    switching: float = -3.0
    break_quality: float = 2.5
    cramming: float = -10.0
    invalid: float = -100.0
    routine_fulfillment: float = 8.0
    routine_overfill: float = -9.0
    routine_distribution: float = 3.0
    exam_substitution_credit: float = 2.0
    duplicate_work: float = -14.0
    method_adherence: float = 5.0
    plan_stability: float = 5.0

    def to_dict(self) -> dict[str, float]:
        return asdict(self)


REWARD_V3_WEIGHTS = RewardV3Weights()


def ensure_directories() -> None:
    for directory in (DATA_DIR, MODELS_DIR, RUNS_DIR):
        directory.mkdir(parents=True, exist_ok=True)
