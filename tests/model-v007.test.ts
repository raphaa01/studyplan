import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { generateAIStudyPlan } from "@/lib/planner/ai-planner";
import { runModelV007 } from "@/lib/planner/model-v007";
import type { AvailabilityDay, Exam } from "@/types/study";

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

  it("builds a usable local plan and preserves fixed appointments", async () => {
    const bytes = await readFile("public/models/learning-planner-v007.weights");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes)));
    const result = await generateAIStudyPlan({
      availability,
      exams: [exam("math", "Mathematik", "2026-08-20"), exam("bio", "Biologie", "2026-08-24")],
      calendarItems: [{ id: "practice", title: "Training", date: today, startTime: "16:30", duration: 60, kind: "appointment", status: "planned" }],
      preferences: { maxDailyMinutes: 180, bufferPercent: .15 },
      now: today,
    });

    expect(result.status).toBe("ready");
    expect(result.plan.planner?.engine).toBe("model-v007");
    expect(result.plan.sessions.some((session) => session.examId)).toBe(true);
    expect(result.plan.sessions.filter((session) => session.examId).every((session) => session.duration <= 30)).toBe(true);
    expect(result.plan.sessions.some((session) => session.date === today && session.startTime < "17:30" && session.startTime >= "16:30")).toBe(false);
    vi.unstubAllGlobals();
  });
});
