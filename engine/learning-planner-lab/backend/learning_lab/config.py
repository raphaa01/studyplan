from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
MODELS_DIR = ROOT / "models"
RUNS_DIR = ROOT / "runs"
EVALUATION_FILE = DATA_DIR / "evaluation_set.json"
REGISTRY_FILE = DATA_DIR / "registry.json"

MAX_EXAMS = 8
EXAM_FEATURES = 11
GLOBAL_FEATURES = 12
SLOT_MINUTES = 30
EVALUATION_SEED = 20260314
EVALUATION_SIZE = 1000
VALIDATION_SEED = 20260401
REWARD_VERSION = "2.0"


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


def ensure_directories() -> None:
    for directory in (DATA_DIR, MODELS_DIR, RUNS_DIR):
        directory.mkdir(parents=True, exist_ok=True)
