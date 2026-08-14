from __future__ import annotations

from pathlib import Path
from time import perf_counter

import numpy as np
import torch
from torch import Tensor, nn
from torch.distributions import Categorical

from .config import EXAM_FEATURES, GLOBAL_FEATURES, MAX_EXAMS, MAX_TARGETS, SLOT_MINUTES, TARGET_FEATURES, TARGET_PRESENT_INDEX, V3_GLOBAL_FEATURES
from .environment import LearningPlanEnv, Observation
from .plans import build_plan_result
from .schemas import PlanResult, Situation


class PlannerActorCritic(nn.Module):
    """Tiny permutation-equivariant policy/value network (~50k parameters)."""

    def __init__(self, hidden: int = 64):
        super().__init__()
        self.hidden = hidden
        self.exam_encoder = nn.Sequential(
            nn.Linear(TARGET_FEATURES, hidden), nn.Tanh(),
            nn.Linear(hidden, hidden), nn.Tanh(),
        )
        self.context_encoder = nn.Sequential(nn.Linear(V3_GLOBAL_FEATURES, 32), nn.Tanh())
        combined = hidden * 2 + 32
        self.exam_score = nn.Sequential(nn.Linear(combined, hidden), nn.Tanh(), nn.Linear(hidden, 1))
        self.idle_score = nn.Sequential(nn.Linear(hidden + 32, 32), nn.Tanh(), nn.Linear(32, 1))
        self.value_head = nn.Sequential(nn.Linear(hidden + 32, hidden), nn.Tanh(), nn.Linear(hidden, 1))

    def forward(self, exams: Tensor, global_features: Tensor, action_mask: Tensor) -> tuple[Tensor, Tensor]:
        encoded = self.exam_encoder(exams)
        exam_present = (exams[..., TARGET_PRESENT_INDEX] > 0).float().unsqueeze(-1)
        pooled = (encoded * exam_present).sum(dim=1) / exam_present.sum(dim=1).clamp(min=1.0)
        context = self.context_encoder(global_features)
        shared = torch.cat([pooled, context], dim=-1)
        expanded = shared.unsqueeze(1).expand(-1, exams.shape[1], -1)
        exam_logits = self.exam_score(torch.cat([encoded, expanded], dim=-1)).squeeze(-1)
        idle_logit = self.idle_score(shared)
        logits = torch.cat([idle_logit, exam_logits], dim=-1)
        logits = logits.masked_fill(~action_mask.bool(), torch.finfo(logits.dtype).min)
        value = self.value_head(shared).squeeze(-1)
        return logits, value

    def parameter_count(self) -> int:
        return sum(parameter.numel() for parameter in self.parameters())

    def estimated_size_bytes(self) -> int:
        return sum(parameter.numel() * parameter.element_size() for parameter in self.parameters())


def observation_tensors(observations: list[Observation], device: torch.device | str = "cpu") -> tuple[Tensor, Tensor, Tensor]:
    exams = torch.as_tensor(np.stack([obs.exams for obs in observations]), dtype=torch.float32, device=device)
    global_features = torch.as_tensor(np.stack([obs.global_features for obs in observations]), dtype=torch.float32, device=device)
    masks = torch.as_tensor(np.stack([obs.action_mask for obs in observations]), dtype=torch.bool, device=device)
    return exams, global_features, masks


class LegacyPlannerActorCritic(PlannerActorCritic):
    """Exact v007 network shape; retained solely for regression evaluation."""

    def __init__(self, hidden: int = 64):
        nn.Module.__init__(self)
        self.hidden = hidden
        self.exam_encoder = nn.Sequential(nn.Linear(EXAM_FEATURES, hidden), nn.Tanh(), nn.Linear(hidden, hidden), nn.Tanh())
        self.context_encoder = nn.Sequential(nn.Linear(GLOBAL_FEATURES, 32), nn.Tanh())
        combined = hidden * 2 + 32
        self.exam_score = nn.Sequential(nn.Linear(combined, hidden), nn.Tanh(), nn.Linear(hidden, 1))
        self.idle_score = nn.Sequential(nn.Linear(hidden + 32, 32), nn.Tanh(), nn.Linear(32, 1))
        self.value_head = nn.Sequential(nn.Linear(hidden + 32, hidden), nn.Tanh(), nn.Linear(hidden, 1))

    def forward(self, exams: Tensor, global_features: Tensor, action_mask: Tensor) -> tuple[Tensor, Tensor]:
        encoded = self.exam_encoder(exams)
        present = (exams[..., -1] > 0).float().unsqueeze(-1)
        pooled = (encoded * present).sum(dim=1) / present.sum(dim=1).clamp(min=1)
        context = self.context_encoder(global_features)
        shared = torch.cat([pooled, context], dim=-1)
        expanded = shared.unsqueeze(1).expand(-1, exams.shape[1], -1)
        logits = torch.cat([self.idle_score(shared), self.exam_score(torch.cat([encoded, expanded], -1)).squeeze(-1)], -1)
        return logits.masked_fill(~action_mask.bool(), torch.finfo(logits.dtype).min), self.value_head(shared).squeeze(-1)


def _legacy_observation(situation: Situation, assignments: list[int], position: int) -> Observation:
    slot = situation.slots[min(position, len(situation.slots) - 1)]
    exam_features = np.zeros((MAX_EXAMS, EXAM_FEATURES), dtype=np.float32)
    previous_action = assignments[position - 1] if position else 0
    mask = np.zeros(MAX_EXAMS + 1, dtype=np.bool_); mask[0] = True
    for index, exam in enumerate(situation.exams[:MAX_EXAMS]):
        assigned = [i for i, action in enumerate(assignments[:position]) if action == index + 1]
        need = float(exam.estimated_need_minutes or 240)
        minutes = len(assigned) * SLOT_MINUTES
        days = {situation.slots[i].day for i in assigned}
        last = situation.slots[assigned[-1]].day if assigned else -1
        allowed = slot.day < exam.days_until
        mask[index + 1] = allowed
        exam_features[index] = [exam.difficulty / 10, exam.importance / 10, min(exam.days_until / 30, 2),
            float(exam.kind == "exam"), min(exam.invested_minutes / max(need, 30), 2), min(minutes / max(need, 30), 2),
            max(0, 1 - (exam.invested_minutes + minutes) / max(need, 30)), min(len(days) / 5, 1),
            float(previous_action == index + 1), min(max(slot.day - last, 0) / 7, 1) if last >= 0 else 1, float(allowed)]
    studied = sum(a > 0 for a in assignments[:position])
    run = 0
    for action in reversed(assignments[:position]):
        if action <= 0: break
        run += 1
    previous_slot = situation.slots[position - 1] if position else None
    same_day = previous_slot is not None and previous_slot.day == slot.day
    contiguous = same_day and previous_slot.end_minute == slot.start_minute
    need = sum(e.estimated_need_minutes or 240 for e in situation.exams)
    globals_ = np.asarray([min(slot.day / 30, 2), slot.start_minute / 1440, position / max(len(situation.slots), 1),
        (len(situation.slots) - position) / max(len(situation.slots), 1), min(run / 6, 1.5), float(previous_action == 0),
        situation.curriculum_level / 5, len(situation.exams) / MAX_EXAMS, min(studied * SLOT_MINUTES / max(need, 30), 2),
        float(same_day), float(contiguous), 1.0], dtype=np.float32)
    return Observation(exams=exam_features, global_features=globals_, action_mask=mask)


@torch.inference_mode()
def generate_plan(model: PlannerActorCritic, situation: Situation, deterministic: bool = True) -> PlanResult:
    started = perf_counter()
    model.eval()
    if isinstance(model, LegacyPlannerActorCritic):
        assignments = [0] * len(situation.slots)
        for position in range(len(situation.slots)):
            observation = _legacy_observation(situation, assignments, position)
            logits, _ = model(*observation_tensors([observation]))
            assignments[position] = int(torch.argmax(logits, -1).item()) if deterministic else int(Categorical(logits=logits).sample().item())
        return build_plan_result(situation, assignments, "QECore v1.07 regression", (perf_counter() - started) * 1000)
    env = LearningPlanEnv(curriculum_level=situation.curriculum_level)
    observation = env.reset(situation=situation)
    done = False
    while not done:
        tensors = observation_tensors([observation])
        logits, _ = model(*tensors)
        action = int(torch.argmax(logits, dim=-1).item()) if deterministic else int(Categorical(logits=logits).sample().item())
        next_observation, _, done, _ = env.step(action)
        if next_observation is not None:
            observation = next_observation
    elapsed_ms = (perf_counter() - started) * 1000.0
    return build_plan_result(situation, env.assignments, "AI", elapsed_ms)


def save_model(model: PlannerActorCritic, path: Path, payload: dict[str, object] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "hidden": model.hidden, **(payload or {})}, path)


def load_model(path: Path, device: str | torch.device = "cpu") -> tuple[PlannerActorCritic, dict[str, object]]:
    checkpoint = torch.load(path, map_location=device, weights_only=False)
    input_width = int(checkpoint["state_dict"]["exam_encoder.0.weight"].shape[1])
    model = (LegacyPlannerActorCritic if input_width == EXAM_FEATURES else PlannerActorCritic)(hidden=int(checkpoint.get("hidden", 64)))
    model.load_state_dict(checkpoint["state_dict"])
    model.to(device).eval()
    metadata = {key: value for key, value in checkpoint.items() if key not in ("state_dict", "hidden")}
    return model, metadata


def transfer_compatible_layers(source: LegacyPlannerActorCritic, target: PlannerActorCritic) -> list[str]:
    """Shape-checked transfer only; changed input/context layers are intentionally skipped."""
    source_state, target_state = source.state_dict(), target.state_dict()
    transferred: list[str] = []
    for name, tensor in source_state.items():
        if name in target_state and target_state[name].shape == tensor.shape and name not in {"exam_encoder.0.weight", "context_encoder.0.weight"}:
            target_state[name] = tensor.detach().clone()
            transferred.append(name)
    target.load_state_dict(target_state)
    return transferred

