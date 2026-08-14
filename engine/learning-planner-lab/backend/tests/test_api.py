from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from learning_lab.api import app


client = TestClient(app)


def test_health_and_challenges_are_real_endpoints() -> None:
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"
    challenges = client.get("/api/challenges")
    assert challenges.status_code == 200
    assert len(challenges.json()) == 7


def test_playground_generates_full_baseline_plan() -> None:
    payload = {
        "exams": [{
            "id": "math", "subject": "Mathematik", "kind": "exam",
            "date": (date.today() + timedelta(days=5)).isoformat(),
            "difficulty": 8, "importance": 9, "invested_minutes": 0,
            "estimated_need_minutes": 240,
        }],
        "windows": [
            {"day": 0, "start_minute": 900, "end_minute": 1020},
            {"day": 2, "start_minute": 960, "end_minute": 1080},
        ],
        "model_id": None, "compare_baselines": True, "seed": 11,
    }
    response = client.post("/api/playground/plan", json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    assert set(result["baselines"]) == {"random", "edf", "weighted", "greedy", "hybrid"}
    assert len(result["baselines"]["greedy"]["assignments"]) == 8
    assert result["baselines"]["greedy"]["sessions"]
