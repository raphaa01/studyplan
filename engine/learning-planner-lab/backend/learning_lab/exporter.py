from __future__ import annotations

from pathlib import Path

import numpy as np
import torch

from .config import EXAM_FEATURES, GLOBAL_FEATURES, MAX_EXAMS
from .model import PlannerActorCritic


def export_onnx(model: PlannerActorCritic, target: Path) -> dict[str, object]:
    import onnx
    import onnxruntime as ort

    target.parent.mkdir(parents=True, exist_ok=True)
    model.eval()
    examples = (
        torch.zeros((1, MAX_EXAMS, EXAM_FEATURES), dtype=torch.float32),
        torch.zeros((1, GLOBAL_FEATURES), dtype=torch.float32),
        torch.ones((1, MAX_EXAMS + 1), dtype=torch.bool),
    )
    with torch.inference_mode():
        expected_logits, expected_value = model(*examples)
    torch.onnx.export(
        model, examples, target,
        input_names=["exams", "global_features", "action_mask"],
        output_names=["logits", "value"], opset_version=17,
        dynamic_axes={
            "exams": {0: "batch"}, "global_features": {0: "batch"},
            "action_mask": {0: "batch"}, "logits": {0: "batch"}, "value": {0: "batch"},
        },
        do_constant_folding=True, dynamo=False,
    )
    loaded = onnx.load(str(target))
    onnx.checker.check_model(loaded)
    session = ort.InferenceSession(str(target), providers=["CPUExecutionProvider"])
    outputs = session.run(None, {
        "exams": examples[0].numpy(),
        "global_features": examples[1].numpy(),
        "action_mask": examples[2].numpy(),
    })
    logits_error = float(np.max(np.abs(outputs[0] - expected_logits.numpy())))
    value_error = float(np.max(np.abs(outputs[1] - expected_value.numpy())))
    if logits_error > 1e-4 or value_error > 1e-4:
        raise RuntimeError(f"ONNX parity check failed ({logits_error=}, {value_error=})")
    return {
        "path": str(target), "size_bytes": target.stat().st_size,
        "loadable": True, "max_logits_error": logits_error, "max_value_error": value_error,
    }
