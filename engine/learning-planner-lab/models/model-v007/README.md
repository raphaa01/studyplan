# Model v007

Reward-v2 checkpoint for the local Learning Planner Lab engine.

- Parent: `model-v006`
- Training: 10,000,000 environment steps
- Selected checkpoint: step 7,700,096
- Fixed evaluation: 60.6115 on 1,000 situations
- Fresh holdout: 61.3625 on 250 situations
- Greedy Reward-v2 baseline: 57.5840
- Parameters: 25,123

`model.pt` contains the PyTorch checkpoint. `model.onnx` is the validated
portable inference artifact. Verify both files with the SHA-256 values in
`metadata.json` before distribution.

The checkpoint optimizes the transparent Reward-v2 objective implemented in
`backend/learning_lab/reward.py`. Its score measures that objective and is not
proof of improved grades or learning outcomes for every person.
