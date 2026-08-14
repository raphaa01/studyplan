export const QECORE_V109 = Object.freeze({
  id: "qecore-v1.09" as const,
  name: "QECore v1.09" as const,
  architecture: "SharedTargetMLP-64" as const,
  schemaVersion: "3.0" as const,
  rewardVersion: "3.0" as const,
  parameters: 26_083,
  sourceOnnxBytes: 111_685,
  sourceOnnxSha256: "63de446731d48c174ee606530f47e34a5993575c2725eadf24d199a3554c5df8" as const,
  weightsUrl: "/models/qecore-v109.weights" as const,
  weightsBytes: 104_332,
  weightsSha256: "ff283db0a144fa3af8c24c336b5afe2e73f7100f73e640fb55ddc7b65d3893cd" as const,
  slotMinutes: 30,
  maxTargets: 12,
  targetFeatures: 24,
  globalFeatures: 16,
  targetPresentIndex: 0,
  maximumDays: 60,
});

interface DenseLayer {
  weightOffset: number;
  biasOffset: number;
  inputs: number;
  outputs: number;
}

const layers = {
  target1: { weightOffset: 0, biasOffset: 1536, inputs: 24, outputs: 64 },
  target2: { weightOffset: 1600, biasOffset: 5696, inputs: 64, outputs: 64 },
  context: { weightOffset: 5760, biasOffset: 6272, inputs: 16, outputs: 32 },
  targetScore1: { weightOffset: 6304, biasOffset: 16544, inputs: 160, outputs: 64 },
  targetScore2: { weightOffset: 16608, biasOffset: 16672, inputs: 64, outputs: 1 },
  idle1: { weightOffset: 16673, biasOffset: 19745, inputs: 96, outputs: 32 },
  idle2: { weightOffset: 19777, biasOffset: 19809, inputs: 32, outputs: 1 },
  value1: { weightOffset: 19810, biasOffset: 25954, inputs: 96, outputs: 64 },
  value2: { weightOffset: 26018, biasOffset: 26082, inputs: 64, outputs: 1 },
} satisfies Record<string, DenseLayer>;

export interface QECoreV109Observation {
  targets: Float32Array;
  globalFeatures: Float32Array;
  actionMask: Uint8Array;
}

export interface QECoreV109Output {
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

export function validateQECoreV109Observation(observation: QECoreV109Observation): boolean {
  return observation.targets.length === QECORE_V109.maxTargets * QECORE_V109.targetFeatures
    && observation.globalFeatures.length === QECORE_V109.globalFeatures
    && observation.actionMask.length === QECORE_V109.maxTargets + 1
    && observation.actionMask[0] === 1
    && [...observation.targets].every(Number.isFinite)
    && [...observation.globalFeatures].every(Number.isFinite);
}

export function runQECoreV109(weights: Float32Array, observation: QECoreV109Observation): QECoreV109Output {
  if (weights.length !== QECORE_V109.parameters) throw new Error("QECore v1.09 hat eine unerwartete Größe.");
  if (!validateQECoreV109Observation(observation)) throw new Error("Die Eingabe passt nicht zu QECore v1.09.");

  const encoded: Float32Array[] = [];
  const pooled = new Float32Array(64);
  let present = 0;
  for (let index = 0; index < QECORE_V109.maxTargets; index += 1) {
    const target = observation.targets.slice(index * QECORE_V109.targetFeatures, (index + 1) * QECORE_V109.targetFeatures);
    const value = dense(weights, dense(weights, target, layers.target1), layers.target2);
    encoded.push(value);
    if (target[QECORE_V109.targetPresentIndex] > 0) {
      present += 1;
      for (let feature = 0; feature < pooled.length; feature += 1) pooled[feature] += value[feature];
    }
  }
  if (present > 0) for (let feature = 0; feature < pooled.length; feature += 1) pooled[feature] /= present;

  const context = dense(weights, observation.globalFeatures, layers.context);
  const shared = concatenate(pooled, context);
  const logits = new Float32Array(QECORE_V109.maxTargets + 1);
  logits[0] = dense(weights, dense(weights, shared, layers.idle1), layers.idle2, false)[0];
  for (let index = 0; index < QECORE_V109.maxTargets; index += 1) {
    const scoreInput = concatenate(encoded[index], shared);
    logits[index + 1] = dense(weights, dense(weights, scoreInput, layers.targetScore1), layers.targetScore2, false)[0];
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
  if (!Number.isFinite(logits[action]) || !Number.isFinite(value)) {
    throw new Error("QECore v1.09 hat ungültige Ausgaben erzeugt.");
  }
  return { logits, value, action };
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Dieses Gerät kann die Modellintegrität nicht prüfen.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function loadQECoreV109(): Promise<Float32Array> {
  if (weightsPromise) return weightsPromise;
  weightsPromise = fetch(QECORE_V109.weightsUrl, { cache: "force-cache" }).then(async (response) => {
    if (!response.ok) throw new Error(`QECore v1.09 konnte nicht geladen werden (${response.status}).`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== QECORE_V109.weightsBytes) throw new Error("QECore v1.09 ist unvollständig.");
    if (await sha256(buffer) !== QECORE_V109.weightsSha256) throw new Error("Die Prüfsumme von QECore v1.09 stimmt nicht.");
    return new Float32Array(buffer);
  }).catch((error) => {
    weightsPromise = null;
    throw error;
  });
  return weightsPromise;
}
