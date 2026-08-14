from __future__ import annotations

from pathlib import Path
import hashlib
import json

import numpy as np
import torch

from .config import MAX_TARGETS, REWARD_VERSION, SCHEMA_VERSION, SLOT_MINUTES, TARGET_FEATURES, V3_GLOBAL_FEATURES
from .model import PlannerActorCritic


def export_onnx(model: PlannerActorCritic, target: Path) -> dict[str, object]:
    import onnx
    import onnxruntime as ort

    target.parent.mkdir(parents=True, exist_ok=True)
    model.eval()
    examples = (
        torch.zeros((1, MAX_TARGETS, TARGET_FEATURES), dtype=torch.float32),
        torch.zeros((1, V3_GLOBAL_FEATURES), dtype=torch.float32),
        torch.ones((1, MAX_TARGETS + 1), dtype=torch.bool),
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
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    manifest = {
        "model_name": "QECore v1.08", "schema_version": SCHEMA_VERSION, "reward_version": REWARD_VERSION,
        "slot_minutes": SLOT_MINUTES, "max_targets": MAX_TARGETS,
        "inputs": {"targets": [1, MAX_TARGETS, TARGET_FEATURES], "global_features": [1, V3_GLOBAL_FEATURES], "action_mask": [1, MAX_TARGETS + 1]},
        "outputs": {"logits": [1, MAX_TARGETS + 1], "value": [1]},
        "action_mapping": "0=idle; 1..N=target row + 1; padded rows masked false",
        "present_feature_index": 0, "sha256": digest,
        "target_feature_order": [
            "present", "is_exam", "is_routine", "has_deadline", "deadline_days_div_30",
            "remaining_need_minutes_div_900", "invested_minutes_div_900", "difficulty_div_10",
            "importance_div_10", "desired_block_slots_div_4", "spacing_preference",
            "interleaving_preference", "preferred_phase", "retrieval_intensity",
            "weekly_sessions_div_7", "weekly_fulfilled_ratio", "remaining_week_slots_div_28",
            "last_gap_days_div_7", "distinct_study_days_div_7", "exam_routine_credit_ratio",
            "allowed_now", "feedback_difficulty", "feedback_confidence", "is_flexible",
        ],
        "global_feature_order": [
            "weekday_div_6", "position_in_week", "slot_position", "remaining_week_slots_ratio",
            "routine_deficit_div_12", "daily_load_slots_div_6", "focus_run_slots_div_6",
            "exam_burden_minutes_div_1800", "flexible_share", "mandatory_share",
            "minute_of_day_div_1440", "previous_was_idle", "curriculum_level_div_5",
            "target_count_div_12", "studied_slot_ratio", "is_contiguous",
        ],
        "fallback": "Use deterministic planner on load/hash/shape/runtime/non-finite/action-mask failure",
    }
    manifest_path = target.parent / "browser-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    golden_path = target.parent / "golden-vector.json"
    golden_path.write_text(json.dumps({
        "targets": examples[0].numpy().tolist(), "global_features": examples[1].numpy().tolist(),
        "action_mask": examples[2].numpy().tolist(), "logits": expected_logits.numpy().tolist(),
        "value": expected_value.numpy().tolist(), "sha256": digest,
    }), encoding="utf-8")
    return {
        "path": str(target), "size_bytes": target.stat().st_size,
        "loadable": True, "max_logits_error": logits_error, "max_value_error": value_error,
        "sha256": digest, "manifest_path": str(manifest_path), "golden_vector_path": str(golden_path),
    }
