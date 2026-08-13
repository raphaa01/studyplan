from __future__ import annotations

import importlib.util

import pytest

from learning_lab.model import PlannerActorCritic
from learning_lab.registry import ModelRegistry


def test_registry_versions_and_parent_metadata(tmp_path, monkeypatch) -> None:
    import learning_lab.registry as registry_module

    monkeypatch.setattr(registry_module, "MODELS_DIR", tmp_path / "models")
    registry = ModelRegistry(tmp_path / "registry.json")
    first = registry.register(PlannerActorCritic(), {"parent_model": None, "training_steps": 10})
    second = registry.register(PlannerActorCritic(), {"parent_model": first["id"], "training_steps": 20})
    assert first["id"] == "model-v001"
    assert second["id"] == "model-v002"
    assert second["parent_model"] == first["id"]
    loaded, _ = registry.load(second["id"])
    assert loaded.parameter_count() == second["parameters"]


@pytest.mark.skipif(
    importlib.util.find_spec("onnx") is None or importlib.util.find_spec("onnxruntime") is None,
    reason="optional ONNX dependencies are not installed",
)
def test_onnx_export_is_loadable_and_matches(tmp_path) -> None:
    from learning_lab.exporter import export_onnx

    result = export_onnx(PlannerActorCritic(), tmp_path / "planner.onnx")
    assert result["loadable"]
    assert result["size_bytes"] < 8 * 1024 * 1024
    assert result["max_logits_error"] < 1e-4

