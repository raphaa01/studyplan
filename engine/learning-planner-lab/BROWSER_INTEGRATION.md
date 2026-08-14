# QECore browser integration contract

## Production model: QECore v1.09

`models/model-v009` is published in the website as
`public/models/qecore-v109.weights`. The browser verifies the 104,332-byte
artifact with SHA-256 before inference and runs the same SharedTargetMLP-64
layers without a heavyweight ONNX runtime. `lib/planner/model-v109.ts` is the
canonical production contract.

The candidate did not pass its routine-fulfillment and exam-only comparison
gates. It is therefore used as a guarded allocation preference: hard masks,
calendar conflicts, breaks, content generation and unfilled idle slots remain
under the deterministic planner's control.

## QECore v1.08 candidate contract

QECore v1.08 uses schema 3.0 and Reward 3.0. It allocates 30-minute planning
slots to at most 12 planning targets. Action `0` is idle; action `n` selects
target row `n - 1`. Target row presence is feature `0` and is independent of
deadline and action masking.

The canonical feature order, shapes, normalization, action mapping and fallback
conditions live in `lib/planner/model-v108.ts`. Every export writes
`browser-manifest.json` and `golden-vector.json` next to `model.onnx`, including
the SHA-256 digest and PyTorch reference outputs. The website must verify all
three before enabling inference.

The neural output never directly creates text, topics, calendar entries or
breaks. `lib/planner/ai-planner.ts` is only the guarded allocation boundary.
The existing deterministic planner remains the safety and fallback layer.

`model-v007` / QECore v1.07 remains a Reward-2/schema-2 regression model. Its
8x11 input must never be passed to the v1.08 runtime and it is not overwritten.
