from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
import torch


ROOT = Path(__file__).resolve().parents[2]
CHECKPOINT = Path(__file__).resolve().parent / "models" / "model-v007" / "model.pt"
TARGET = ROOT / "public" / "models" / "learning-planner-v007.weights"

EXPECTED = [
    ("exam_encoder.0.weight", (64, 11)),
    ("exam_encoder.0.bias", (64,)),
    ("exam_encoder.2.weight", (64, 64)),
    ("exam_encoder.2.bias", (64,)),
    ("context_encoder.0.weight", (32, 12)),
    ("context_encoder.0.bias", (32,)),
    ("exam_score.0.weight", (64, 160)),
    ("exam_score.0.bias", (64,)),
    ("exam_score.2.weight", (1, 64)),
    ("exam_score.2.bias", (1,)),
    ("idle_score.0.weight", (32, 96)),
    ("idle_score.0.bias", (32,)),
    ("idle_score.2.weight", (1, 32)),
    ("idle_score.2.bias", (1,)),
    ("value_head.0.weight", (64, 96)),
    ("value_head.0.bias", (64,)),
    ("value_head.2.weight", (1, 64)),
    ("value_head.2.bias", (1,)),
]


def main() -> None:
    checkpoint = torch.load(CHECKPOINT, map_location="cpu", weights_only=True)
    state = checkpoint["state_dict"]
    arrays: list[np.ndarray] = []
    for name, shape in EXPECTED:
        tensor = state[name].detach().cpu()
        if tuple(tensor.shape) != shape:
            raise ValueError(f"Unexpected shape for {name}: {tuple(tensor.shape)}")
        arrays.append(tensor.numpy().astype("<f4", copy=False).reshape(-1))

    payload = np.concatenate(arrays).tobytes()
    if len(payload) != 25_123 * 4:
        raise ValueError(f"Unexpected browser weight size: {len(payload)}")
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_bytes(payload)
    print(f"{TARGET.relative_to(ROOT)} {len(payload)} bytes sha256={hashlib.sha256(payload).hexdigest()}")


if __name__ == "__main__":
    main()
