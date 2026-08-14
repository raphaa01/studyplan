from __future__ import annotations

from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .baselines import BASELINES
from .challenges import challenge_cases
from .config import MAX_TARGETS, MODELS_DIR, ROOT, ensure_directories
from .exporter import export_onnx
from .generator import ensure_evaluation_set, windows_to_slots
from .manager import TrainingManager
from .model import generate_plan
from .registry import ModelRegistry
from .schemas import Exam, PlaygroundRequest, RenameModelRequest, Situation, TrainingCommand


ensure_directories()
ensure_evaluation_set()
registry = ModelRegistry()
training = TrainingManager(registry)
app = FastAPI(title="Learning Planner Lab", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, object]:
    return {"status": "ok", "version": app.version, "models": len(registry.list())}


@app.get("/api/training/status")
def training_status():
    return training.status()


@app.post("/api/training/start")
def start_training(command: TrainingCommand):
    try:
        return training.start(command.config)
    except KeyError as exc:
        raise HTTPException(404, f"Parent model {exc.args[0]} was not found") from exc
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(409, str(exc)) from exc


@app.post("/api/training/pause")
def pause_training():
    try:
        return training.pause()
    except RuntimeError as exc:
        raise HTTPException(409, str(exc)) from exc


@app.post("/api/training/resume")
def resume_training():
    try:
        return training.resume()
    except RuntimeError as exc:
        raise HTTPException(409, str(exc)) from exc


@app.post("/api/training/stop")
def stop_training():
    try:
        return training.stop()
    except RuntimeError as exc:
        raise HTTPException(409, str(exc)) from exc


@app.get("/api/models")
def models():
    return registry.list()


@app.patch("/api/models/{model_id}")
def rename_model(model_id: str, request: RenameModelRequest):
    try:
        return registry.rename(model_id, request.name)
    except KeyError as exc:
        raise HTTPException(404, "Model not found") from exc


@app.delete("/api/models/{model_id}", status_code=204)
def delete_model(model_id: str):
    try:
        registry.delete(model_id)
    except KeyError as exc:
        raise HTTPException(404, "Model not found") from exc


@app.post("/api/models/{model_id}/export")
def export_model(model_id: str):
    try:
        model, payload = registry.load(model_id)
    except KeyError as exc:
        raise HTTPException(404, "Model not found") from exc
    target = MODELS_DIR / model_id / "model.onnx"
    if not payload["registry"].get("training_compatible"):
        raise HTTPException(409, "Legacy QECore models retain their existing export; v3 export requires schema 3.0")
    try:
        return export_onnx(model, target)
    except Exception as exc:
        raise HTTPException(500, f"ONNX export failed: {exc}") from exc


@app.get("/api/models/{model_id}/download/{format}")
def download_model(model_id: str, format: str):
    item = registry.get(model_id)
    if not item:
        raise HTTPException(404, "Model not found")
    target = Path(item["model_path"]) if format == "pytorch" else MODELS_DIR / model_id / "model.onnx"
    if format not in ("pytorch", "onnx") or not target.exists():
        raise HTTPException(404, "Requested export does not exist")
    return FileResponse(target, filename=target.name)


@app.post("/api/playground/plan")
def playground_plan(request: PlaygroundRequest):
    if not request.exams and not request.routines:
        raise HTTPException(422, "Provide at least one exam or routine")
    if len(request.exams) + len(request.routines) > MAX_TARGETS:
        raise HTTPException(422, f"Provide at most {MAX_TARGETS} planning targets")
    today = date.today()
    exams: list[Exam] = []
    for value in request.exams:
        days_until = (value.date - today).days
        if days_until < 1:
            raise HTTPException(422, f"{value.subject}: exam date must be in the future")
        if days_until > 60:
            raise HTTPException(422, f"{value.subject}: version 0.2 supports a planning horizon of at most 60 days")
        exams.append(Exam(
            id=value.id, subject=value.subject, subject_id=value.subject_id, kind=value.kind, days_until=days_until,
            difficulty=value.difficulty, importance=value.importance,
            invested_minutes=value.invested_minutes, estimated_need_minutes=value.estimated_need_minutes,
            learning_method=value.learning_method, feedback=value.feedback,
        ))
    slots = windows_to_slots(request.windows)
    if not slots:
        raise HTTPException(422, "At least one complete 30-minute availability slot is required")
    situation = Situation(
        id="playground", exams=exams, routines=request.routines, windows=request.windows, slots=slots,
        curriculum_level=5, seed=request.seed, schema_version="3.0",
    )
    output: dict[str, object] = {"situation": situation.model_dump(mode="json")}
    if request.model_id:
        try:
            model, _ = registry.load(request.model_id)
        except KeyError as exc:
            raise HTTPException(404, "Selected model not found") from exc
        output["ai"] = generate_plan(model, situation).model_dump(mode="json")
    if request.compare_baselines:
        output["baselines"] = {
            name: (scheduler(situation, seed=request.seed) if name == "random" else scheduler(situation)).model_dump(mode="json")
            for name, scheduler in BASELINES.items()
        }
    return output


@app.get("/api/challenges")
def challenges():
    return challenge_cases()


@app.post("/api/challenges/{case_id}/run")
def run_challenge(case_id: str, model_id: str):
    item = next((case for case in challenge_cases() if case["id"] == case_id), None)
    if not item:
        raise HTTPException(404, "Challenge case not found")
    try:
        model, _ = registry.load(model_id)
    except KeyError as exc:
        raise HTTPException(404, "Selected model not found") from exc
    situation = Situation.model_validate(item["situation"])
    return {
        "case": item,
        "ai": generate_plan(model, situation).model_dump(mode="json"),
        "baselines": {name: (fn(situation, seed=situation.seed) if name == "random" else fn(situation)).model_dump(mode="json") for name, fn in BASELINES.items()},
    }


frontend_dist = ROOT / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/{path:path}")
    def serve_frontend(path: str):
        candidate = (frontend_dist / path).resolve()
        if candidate.is_file() and frontend_dist.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(frontend_dist / "index.html")
