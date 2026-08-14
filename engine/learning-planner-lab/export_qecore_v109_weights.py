from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
import torch


ROOT = Path(__file__).resolve().parent
CHECKPOINT = ROOT / "models" / "model-v009" / "model.pt"
OUTPUT = ROOT.parent.parent / "public" / "models" / "qecore-v109.weights"
STATE_KEYS = (
    "exam_encoder.0.weight", "exam_encoder.0.bias",
    "exam_encoder.2.weight", "exam_encoder.2.bias",
    "context_encoder.0.weight", "context_encoder.0.bias",
    "exam_score.0.weight", "exam_score.0.bias",
    "exam_score.2.weight", "exam_score.2.bias",
    "idle_score.0.weight", "idle_score.0.bias",
    "idle_score.2.weight", "idle_score.2.bias",
    "value_head.0.weight", "value_head.0.bias",
    "value_head.2.weight", "value_head.2.bias",
)


def main() -> None:
    checkpoint = torch.load(CHECKPOINT, map_location="cpu", weights_only=True)
    state = checkpoint["state_dict"]
    values = np.concatenate([
        state[key].detach().cpu().numpy().astype("<f4", copy=False).reshape(-1)
        for key in STATE_KEYS
    ])
    if values.size != 26_083:
        raise RuntimeError(f"unexpected QECore v1.09 parameter count: {values.size}")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(values.tobytes())
    print(f"{OUTPUT}: {OUTPUT.stat().st_size} bytes")
    print(hashlib.sha256(OUTPUT.read_bytes()).hexdigest())


if __name__ == "__main__":
    main()
