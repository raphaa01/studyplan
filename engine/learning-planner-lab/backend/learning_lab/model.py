from __future__ import annotations

from pathlib import Path
from time import perf_counter

import numpy as np
import torch
from torch import Tensor, nn
from torch.distributions import Categorical

from .config import EXAM_FEATURES, GLOBAL_FEATURES, MAX_EXAMS
from .environment import LearningPlanEnv, Observation
from .plans import build_plan_result
from .schemas import PlanResult, Situation


class PlannerActorCritic(nn.Module):
    """Tiny permutation-equivariant policy/value network (~50k parameters)."""

    def __init__(self, hidden: int = 64):
        super().__init__()
        self.hidden = hidden
        self.exam_encoder = nn.Sequential(
            nn.Linear(EXAM_FEATURES, hidden), nn.Tanh(),
            nn.Linear(hidden, hidden), nn.Tanh(),
        )
        self.context_encoder = nn.Sequential(nn.Linear(GLOBAL_FEATURES, 32), nn.Tanh())
        combined = hidden * 2 + 32
        self.exam_score = nn.Sequential(nn.Linear(combined, hidden), nn.Tanh(), nn.Linear(hidden, 1))
        self.idle_score = nn.Sequential(nn.Linear(hidden + 32, 32), nn.Tanh(), nn.Linear(32, 1))
        self.value_head = nn.Sequential(nn.Linear(hidden + 32, hidden), nn.Tanh(), nn.Linear(hidden, 1))

    def forward(self, exams: Tensor, global_features: Tensor, action_mask: Tensor) -> tuple[Tensor, Tensor]:
        encoded = self.exam_encoder(exams)
        exam_present = (exams[..., -1] > 0).float().unsqueeze(-1)
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


@torch.inference_mode()
def generate_plan(model: PlannerActorCritic, situation: Situation, deterministic: bool = True) -> PlanResult:
    started = perf_counter()
    env = LearningPlanEnv(curriculum_level=situation.curriculum_level)
    observation = env.reset(situation=situation)
    model.eval()
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
    model = PlannerActorCritic(hidden=int(checkpoint.get("hidden", 64)))
    model.load_state_dict(checkpoint["state_dict"])
    model.to(device).eval()
    metadata = {key: value for key, value in checkpoint.items() if key not in ("state_dict", "hidden")}
    return model, metadata

