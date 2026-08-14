import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { generateAIStudyPlan } from "@/lib/planner/ai-planner";
import { QECORE_V109, runQECoreV109 } from "@/lib/planner/model-v109";
import type { AvailabilityDay, Exam, LearningRoutine } from "@/types/study";

const today = "2026-08-13";
const availability: AvailabilityDay[] = Array.from({ length: 7 }, (_, day) => ({
  day,
  enabled: true,
  windows: [{ id: `window-${day}`, start: "16:00", end: "18:00" }],
}));
const exam = (id: string, subject: string, date: string): Exam => ({
  id,
  subject,
  title: `${subject} Klausur`,
  type: "exam",
  date,
  size: "large",
  importance: 4,
  estimatedHours: 5,
  color: "#47624b",
  learningMethod: "auto",
  topics: [{ id: `${id}-topic`, name: "Grundlagen", confidence: 2 }],
});

async function browserWeights() {
  const bytes = await readFile("public/models/qecore-v109.weights");
  return { bytes, values: new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / Float32Array.BYTES_PER_ELEMENT) };
}

describe("QECore v1.09 browser inference", () => {
  it("matches the published ONNX golden vector and checksum", async () => {
    const { bytes, values } = await browserWeights();
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(QECORE_V109.weightsSha256);
    const observation = {
      targets: new Float32Array(QECORE_V109.maxTargets * QECORE_V109.targetFeatures),
      globalFeatures: new Float32Array(QECORE_V109.globalFeatures),
      actionMask: new Uint8Array(QECORE_V109.maxTargets + 1).fill(1),
    };
    const output = runQECoreV109(values, observation);
    expect(output.logits[0]).toBeCloseTo(-1.100537896156311, 4);
    expect(output.logits[1]).toBeCloseTo(-1.131915807723999, 4);
    expect(output.value).toBeCloseTo(-3.977325201034546, 4);
    expect(output.action).toBe(0);
  });

  it("builds a local plan and preserves fixed appointments", async () => {
    const { bytes } = await browserWeights();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes)));
    const result = await generateAIStudyPlan({
      availability,
      exams: [exam("math", "Mathematik", "2026-08-20"), exam("bio", "Biologie", "2026-08-24")],
      calendarItems: [{ id: "practice", title: "Training", date: today, startTime: "16:30", duration: 60, kind: "appointment", status: "planned" }],
      preferences: { maxDailyMinutes: 180, bufferPercent: 0.15 },
      now: today,
    });

    expect(result.status).toBe("ready");
    expect(result.plan.planner?.engine).toBe("qecore-v1.09");
    expect(result.plan.planner?.rewardVersion).toBe("3.0");
    expect(result.plan.sessions.some((session) => session.examId)).toBe(true);
    expect(result.plan.sessions.filter((session) => session.examId).every((session) => session.duration <= 30)).toBe(true);
    expect(result.plan.sessions.some((session) => session.date === today && session.startTime < "17:30" && session.startTime >= "16:30")).toBe(false);
    vi.unstubAllGlobals();
  });

  it("keeps flexible weekly routines fulfilled through the safety layer", async () => {
    const { bytes } = await browserWeights();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes)));
    const routine: LearningRoutine = {
      id: "math-routine",
      subjectId: "mathematik",
      subject: "Mathematik",
      title: "Mathematik festigen",
      sessionsPerWeek: 2,
      preferredSessionMinutes: 30,
      importance: 3,
      difficulty: 3,
      learningMethod: "interleaving",
      flexible: true,
      enabled: true,
    };
    const result = await generateAIStudyPlan({ availability, exams: [], routines: [routine], now: today });
    const routineDays = new Set(result.plan.sessions.filter((session) => session.routineId === routine.id).map((session) => session.date));

    expect(result.status).toBe("ready");
    expect(result.plan.planner?.engine).toBe("qecore-v1.09");
    expect(routineDays.size).toBeGreaterThanOrEqual(2);
    vi.unstubAllGlobals();
  });
});
