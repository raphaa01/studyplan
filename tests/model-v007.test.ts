import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runModelV007 } from "@/lib/planner/model-v007";

async function browserWeights() {
  const bytes = await readFile("public/models/learning-planner-v007.weights");
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / Float32Array.BYTES_PER_ELEMENT);
}

describe("model-v007 browser inference", () => {
  it("matches the published PyTorch checkpoint on a golden observation", async () => {
    const exams = new Float32Array(8 * 11);
    exams.set([.5, .6, .2, 1, 0, .1, .9, .2, 0, 1, 1], 0);
    exams.set([.7, .8, .1, 0, .1, 0, .9, 0, 1, 1, 1], 11);
    const output = runModelV007(await browserWeights(), {
      exams,
      globalFeatures: new Float32Array([0, .666, .1, .9, .2, 0, 1, .25, .1, 1, 1, 1]),
      actionMask: [true, true, true, false, false, false, false, false, false],
    });

    expect(output.action).toBe(2);
    expect([...output.logits.slice(0, 3)]).toEqual([
      expect.closeTo(-14.927621841430664, 4),
      expect.closeTo(1.1641665697097778, 4),
      expect.closeTo(17.357192993164062, 4),
    ]);
    expect(output.value).toBeCloseTo(46.16644287109375, 4);
  });
});
