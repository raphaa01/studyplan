export const PLANNER_MODEL_V007 = Object.freeze({
  id: "model-v007" as const,
  architecture: "SharedExamMLP-64" as const,
  rewardVersion: "2.0" as const,
  parameters: 25_123,
  sourceOnnxBytes: 107_845,
  sourceOnnxSha256: "4b56cc1fcef15be2f27e73b1d03814c49062c528cc81b035770636d2e9927b97" as const,
  weightsUrl: "/models/learning-planner-v007.weights" as const,
  weightsBytes: 100_492,
  weightsSha256: "18fbb6812b34683a4af10759c440cb18713ae8beb80f323d86a28a2d4db460cc" as const,
  maximumExams: 8,
  maximumDays: 60,
  slotMinutes: 30,
});

interface DenseLayer {
  weightOffset: number;
  biasOffset: number;
  inputs: number;
  outputs: number;
}

const layers = {
  exam1: { weightOffset: 0, biasOffset: 704, inputs: 11, outputs: 64 },
  exam2: { weightOffset: 768, biasOffset: 4864, inputs: 64, outputs: 64 },
  context: { weightOffset: 4928, biasOffset: 5312, inputs: 12, outputs: 32 },
  examScore1: { weightOffset: 5344, biasOffset: 15584, inputs: 160, outputs: 64 },
  examScore2: { weightOffset: 15648, biasOffset: 15712, inputs: 64, outputs: 1 },
  idle1: { weightOffset: 15713, biasOffset: 18785, inputs: 96, outputs: 32 },
  idle2: { weightOffset: 18817, biasOffset: 18849, inputs: 32, outputs: 1 },
  value1: { weightOffset: 18850, biasOffset: 24994, inputs: 96, outputs: 64 },
  value2: { weightOffset: 25058, biasOffset: 25122, inputs: 64, outputs: 1 },
} satisfies Record<string, DenseLayer>;

export interface ModelV007Observation {
  exams: Float32Array;
  globalFeatures: Float32Array;
  actionMask: readonly boolean[];
}

export interface ModelV007Output {
  logits: Float32Array;
  value: number;
  action: number;
}

let weightsPromise: Promise<Float32Array> | null = null;

function dense(weights: Float32Array, input: Float32Array, layer: DenseLayer, activate = true): Float32Array {
  const output = new Float32Array(layer.outputs);
  for (let row = 0; row < layer.outputs; row += 1) {
    let value = weights[layer.biasOffset + row];
    const rowOffset = layer.weightOffset + row * layer.inputs;
    for (let column = 0; column < layer.inputs; column += 1) value += weights[rowOffset + column] * input[column];
    output[row] = activate ? Math.tanh(value) : value;
  }
  return output;
}

function concatenate(...arrays: Float32Array[]): Float32Array {
  const output = new Float32Array(arrays.reduce((sum, value) => sum + value.length, 0));
  let offset = 0;
  for (const value of arrays) {
    output.set(value, offset);
    offset += value.length;
  }
  return output;
}

export function runModelV007(weights: Float32Array, observation: ModelV007Observation): ModelV007Output {
  if (weights.length !== PLANNER_MODEL_V007.parameters) throw new Error("Das Planungsmodell hat eine unerwartete Größe.");
  if (observation.exams.length !== 8 * 11 || observation.globalFeatures.length !== 12 || observation.actionMask.length !== 9) {
    throw new Error("Die Eingabe passt nicht zum Vertrag von model-v007.");
  }

  const encoded: Float32Array[] = [];
  const pooled = new Float32Array(64);
  let present = 0;
  for (let index = 0; index < 8; index += 1) {
    const exam = observation.exams.slice(index * 11, (index + 1) * 11);
    const value = dense(weights, dense(weights, exam, layers.exam1), layers.exam2);
    encoded.push(value);
    if (exam[10] > 0) {
      present += 1;
      for (let feature = 0; feature < pooled.length; feature += 1) pooled[feature] += value[feature];
    }
  }
  if (present > 0) for (let feature = 0; feature < pooled.length; feature += 1) pooled[feature] /= present;

  const context = dense(weights, observation.globalFeatures, layers.context);
  const shared = concatenate(pooled, context);
  const logits = new Float32Array(9);
  logits[0] = dense(weights, dense(weights, shared, layers.idle1), layers.idle2, false)[0];
  for (let index = 0; index < 8; index += 1) {
    const scoreInput = concatenate(encoded[index], shared);
    logits[index + 1] = dense(weights, dense(weights, scoreInput, layers.examScore1), layers.examScore2, false)[0];
  }
  let action = 0;
  let best = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < logits.length; index += 1) {
    if (!observation.actionMask[index]) {
      logits[index] = Number.NEGATIVE_INFINITY;
      continue;
    }
    if (logits[index] > best) {
      best = logits[index];
      action = index;
    }
  }
  const value = dense(weights, dense(weights, shared, layers.value1), layers.value2, false)[0];
  return { logits, value, action };
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Dieses Gerät kann die Modellintegrität nicht prüfen.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function loadModelV007(): Promise<Float32Array> {
  if (weightsPromise) return weightsPromise;
  weightsPromise = fetch(PLANNER_MODEL_V007.weightsUrl, { cache: "force-cache" }).then(async (response) => {
    if (!response.ok) throw new Error(`Planungsmodell konnte nicht geladen werden (${response.status}).`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== PLANNER_MODEL_V007.weightsBytes) throw new Error("Das Planungsmodell ist unvollständig.");
    if (await sha256(buffer) !== PLANNER_MODEL_V007.weightsSha256) throw new Error("Die Prüfsumme des Planungsmodells stimmt nicht.");
    return new Float32Array(buffer);
  }).catch((error) => {
    weightsPromise = null;
    throw error;
  });
  return weightsPromise;
}
