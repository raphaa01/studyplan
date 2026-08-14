from __future__ import annotations

import json
import math
import os
import random
import time
from copy import deepcopy
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from threading import Event
from typing import Callable

import numpy as np
import torch
from torch import Tensor
from torch.distributions import Categorical

from .config import RUNS_DIR, VALIDATION_SEED
from .environment import LearningPlanEnv, Observation, curriculum_level
from .generator import SituationGenerator
from .evaluation import evaluate_model
from .model import LegacyPlannerActorCritic, PlannerActorCritic, load_model, observation_tensors, save_model, transfer_compatible_layers
from .schemas import TrainingConfig


MetricCallback = Callable[[dict[str, float | int | str]], None]


@dataclass
class TrainingResult:
    model: PlannerActorCritic
    optimizer_state: dict[str, object]
    steps: int
    episodes: int
    duration_seconds: float
    final_reward: float
    best_validation_reward: float
    best_step: int
    selected_best_checkpoint: bool
    stopped: bool
    run_directory: Path


def train_ppo(
    config: TrainingConfig,
    run_id: str,
    callback: MetricCallback,
    pause_event: Event,
    stop_event: Event,
    parent_path: Path | None = None,
    load_parent_optimizer: bool = True,
) -> TrainingResult:
    random.seed(config.seed)
    np.random.seed(config.seed)
    torch.manual_seed(config.seed)
    torch.set_num_threads(max(1, min(os.cpu_count() or 1, max(config.parallel_envs, 2))))
    device = torch.device("cpu")
    transferred_layers: list[str] = []
    if parent_path:
        parent_model = load_model(parent_path, device)[0]
        if isinstance(parent_model, LegacyPlannerActorCritic):
            if config.init_mode != "compatible_transfer":
                raise ValueError("QECore v1.07 has incompatible v2 inputs; choose compatible_transfer or train from scratch")
            model = PlannerActorCritic()
            transferred_layers = transfer_compatible_layers(parent_model, model)
            load_parent_optimizer = False
        else:
            model = parent_model
    else:
        model = PlannerActorCritic()
    model.train()
    optimizer = torch.optim.Adam(model.parameters(), lr=config.learning_rate)
    if parent_path and load_parent_optimizer:
        _, payload = load_model(parent_path, device)
        state = payload.get("optimizer_state")
        if isinstance(state, dict):
            try:
                optimizer.load_state_dict(state)
            except (ValueError, KeyError):
                pass

    run_directory = RUNS_DIR / run_id
    run_directory.mkdir(parents=True, exist_ok=True)
    (run_directory / "config.json").write_text(config.model_dump_json(indent=2), encoding="utf-8")
    (run_directory / "transfer.json").write_text(json.dumps({"source": str(parent_path) if parent_path else None, "layers": transferred_layers}), encoding="utf-8")

    env_count = config.parallel_envs
    generators = [SituationGenerator(config.seed + 1009 * i) for i in range(env_count)]
    envs = [LearningPlanEnv(generators[i], curriculum_level=1) for i in range(env_count)]
    observations = [env.reset(seed=config.seed + i) for i, env in enumerate(envs)]
    episode_returns = np.zeros(env_count, dtype=np.float32)
    completed_rewards: deque[float] = deque(maxlen=100)
    steps = 0
    episodes = 0
    started = time.perf_counter()
    last_checkpoint = 0
    stopped = False
    validation_generator = SituationGenerator(VALIDATION_SEED)
    validation_subset = [
        validation_generator.generate(5, seed=VALIDATION_SEED + i)
        for i in range(config.validation_size)
    ]
    # Long runs get substantially more than ten safety checks. At the observed
    # local throughput, 50k steps is well below a minute; slower machines still
    # retain a bounded validation cadence.
    evaluation_interval = max(config.rollout_steps, min(config.total_steps // 10, 50_000))
    next_evaluation = evaluation_interval
    model.eval()
    best_validation_reward = float(evaluate_model(model, validation_subset)["mean_reward"])
    model.train()
    best_step = 0
    best_state = deepcopy(model.state_dict())
    best_optimizer_state = deepcopy(optimizer.state_dict())
    evaluations_without_improvement = 0
    save_model(model, run_directory / "best.pt", {
        "optimizer_state": best_optimizer_state,
        "steps": best_step,
        "validation_reward": best_validation_reward,
        "config": config.model_dump(),
    })

    while steps < config.total_steps and (config.max_episodes is None or episodes < config.max_episodes):
        while pause_event.is_set() and not stop_event.is_set():
            time.sleep(0.1)
        if stop_event.is_set():
            stopped = True
            break

        level = curriculum_level(steps, config.total_steps) if config.curriculum else 5
        for env in envs:
            env.curriculum_level = level

        batch_obs: list[list[Observation]] = []
        batch_actions: list[Tensor] = []
        batch_log_probs: list[Tensor] = []
        batch_values: list[Tensor] = []
        batch_rewards: list[Tensor] = []
        batch_dones: list[Tensor] = []
        rollout_length = max(1, math.ceil(config.rollout_steps / env_count))

        for _ in range(rollout_length):
            exams, globals_, masks = observation_tensors(observations, device)
            with torch.no_grad():
                logits, values = model(exams, globals_, masks)
                distribution = Categorical(logits=logits)
                actions = distribution.sample()
                log_probs = distribution.log_prob(actions)
            rewards = np.zeros(env_count, dtype=np.float32)
            dones = np.zeros(env_count, dtype=np.float32)
            next_observations: list[Observation] = []
            for i, env in enumerate(envs):
                next_observation, reward, done, info = env.step(int(actions[i].item()))
                episode_returns[i] += reward
                rewards[i] = reward
                dones[i] = float(done)
                if done:
                    episodes += 1
                    completed_rewards.append(float(info["plan_reward"]))
                    episode_returns[i] = 0.0
                    next_observation = env.reset(seed=config.seed + steps + i + episodes * 37)
                assert next_observation is not None
                next_observations.append(next_observation)
            batch_obs.append(observations)
            batch_actions.append(actions)
            batch_log_probs.append(log_probs)
            batch_values.append(values)
            batch_rewards.append(torch.as_tensor(rewards, device=device))
            batch_dones.append(torch.as_tensor(dones, device=device))
            observations = next_observations
            steps += env_count
            if stop_event.is_set() or steps >= config.total_steps or (config.max_episodes is not None and episodes >= config.max_episodes):
                break

        with torch.no_grad():
            next_values = model(*observation_tensors(observations, device))[1]
        rewards_tensor = torch.stack(batch_rewards)
        dones_tensor = torch.stack(batch_dones)
        values_tensor = torch.stack(batch_values)
        advantages = torch.zeros_like(rewards_tensor)
        gae = torch.zeros(env_count, device=device)
        for t in reversed(range(len(batch_rewards))):
            continuation = 1.0 - dones_tensor[t]
            following = next_values if t == len(batch_rewards) - 1 else values_tensor[t + 1]
            delta = rewards_tensor[t] + config.gamma * following * continuation - values_tensor[t]
            gae = delta + config.gamma * config.gae_lambda * continuation * gae
            advantages[t] = gae
        returns = advantages + values_tensor

        flat_observations = [obs for time_slice in batch_obs for obs in time_slice]
        flat_exams, flat_globals, flat_masks = observation_tensors(flat_observations, device)
        flat_actions = torch.stack(batch_actions).reshape(-1)
        old_log_probs = torch.stack(batch_log_probs).reshape(-1)
        flat_advantages = advantages.reshape(-1)
        flat_returns = returns.reshape(-1)
        flat_advantages = (flat_advantages - flat_advantages.mean()) / (flat_advantages.std() + 1e-8)

        sample_count = len(flat_actions)
        latest = {"loss": 0.0, "policy_loss": 0.0, "value_loss": 0.0, "entropy": 0.0}
        updates = 0
        for _ in range(config.epochs):
            permutation = torch.randperm(sample_count)
            for start in range(0, sample_count, config.batch_size):
                indices = permutation[start : start + config.batch_size]
                logits, values = model(flat_exams[indices], flat_globals[indices], flat_masks[indices])
                distribution = Categorical(logits=logits)
                new_log_probs = distribution.log_prob(flat_actions[indices])
                ratio = torch.exp(new_log_probs - old_log_probs[indices])
                unclipped = ratio * flat_advantages[indices]
                clipped = torch.clamp(ratio, 1 - config.clip_range, 1 + config.clip_range) * flat_advantages[indices]
                policy_loss = -torch.min(unclipped, clipped).mean()
                value_loss = 0.5 * (flat_returns[indices] - values).pow(2).mean()
                entropy = distribution.entropy().mean()
                loss = policy_loss + config.value_coef * value_loss - config.entropy_coef * entropy
                optimizer.zero_grad(set_to_none=True)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), config.max_grad_norm)
                optimizer.step()
                latest["loss"] += float(loss.item())
                latest["policy_loss"] += float(policy_loss.item())
                latest["value_loss"] += float(value_loss.item())
                latest["entropy"] += float(entropy.item())
                updates += 1
        for key in latest:
            latest[key] /= max(updates, 1)

        elapsed = max(time.perf_counter() - started, 1e-6)
        reward_mean = float(np.mean(completed_rewards)) if completed_rewards else 0.0
        metric_payload: dict[str, float | int | str] = {
            "steps": min(steps, config.total_steps), "episodes": episodes,
            "reward": float(completed_rewards[-1]) if completed_rewards else 0.0,
            "moving_reward": reward_mean, "curriculum_level": level,
            "steps_per_second": steps / elapsed, "episodes_per_second": episodes / elapsed,
            "learning_rate": optimizer.param_groups[0]["lr"], **latest,
        }
        if steps >= next_evaluation:
            model.eval()
            validation_reward = float(evaluate_model(model, validation_subset)["mean_reward"])
            model.train()
            metric_payload["evaluation_reward"] = validation_reward
            if validation_reward > best_validation_reward + 1e-6:
                best_validation_reward = validation_reward
                best_step = min(steps, config.total_steps)
                best_state = deepcopy(model.state_dict())
                best_optimizer_state = deepcopy(optimizer.state_dict())
                evaluations_without_improvement = 0
                save_model(model, run_directory / "best.pt", {
                    "optimizer_state": best_optimizer_state,
                    "steps": best_step,
                    "validation_reward": best_validation_reward,
                    "config": config.model_dump(),
                })
            else:
                evaluations_without_improvement += 1
                if config.adaptive_learning_rate and evaluations_without_improvement >= 2:
                    for group in optimizer.param_groups:
                        group["lr"] = max(float(group["lr"]) * 0.5, config.min_learning_rate)
                    evaluations_without_improvement = 0
            metric_payload["best_evaluation_reward"] = best_validation_reward
            metric_payload["best_step"] = best_step
            next_evaluation += evaluation_interval
        callback(metric_payload)

        if steps - last_checkpoint >= config.checkpoint_interval:
            save_model(model, run_directory / "checkpoint.pt", {
                "optimizer_state": optimizer.state_dict(), "steps": steps, "config": config.model_dump(),
            })
            last_checkpoint = steps

    duration = time.perf_counter() - started
    save_model(model, run_directory / ("interrupted.pt" if stopped else "last.pt"), {
        "optimizer_state": optimizer.state_dict(), "steps": steps, "config": config.model_dump(),
    })
    selected_best = False
    if not stopped:
        model.load_state_dict(best_state)
        optimizer.load_state_dict(best_optimizer_state)
        selected_best = best_step != min(steps, config.total_steps)
        save_model(model, run_directory / "final.pt", {
            "optimizer_state": optimizer.state_dict(),
            "steps": best_step,
            "validation_reward": best_validation_reward,
            "selected_best_checkpoint": selected_best,
            "config": config.model_dump(),
        })
    summary = {
        "steps": min(steps, config.total_steps), "episodes": episodes, "duration_seconds": duration,
        "final_reward": float(np.mean(completed_rewards)) if completed_rewards else 0.0,
        "best_validation_reward": best_validation_reward,
        "best_step": best_step,
        "selected_best_checkpoint": selected_best,
        "stopped": stopped,
    }
    (run_directory / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return TrainingResult(
        model=model, optimizer_state=optimizer.state_dict(), steps=min(steps, config.total_steps),
        episodes=episodes, duration_seconds=duration, final_reward=summary["final_reward"],
        best_validation_reward=best_validation_reward, best_step=best_step,
        selected_best_checkpoint=selected_best,
        stopped=stopped, run_directory=run_directory,
    )
