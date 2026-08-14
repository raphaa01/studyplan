import { describe, expect, it } from "vitest";
import { generateStudyPlan } from "@/lib/planner";
import { selectQECoreAction } from "@/lib/planner/ai-planner";
import { QECORE_V108, validateQECoreObservation } from "@/lib/planner/model-v108";
import { addDays } from "@/lib/planner/date-utils";
import type { AvailabilityDay, Exam, LearningRoutine } from "@/types/study";

const today = "2026-08-10";
const availability: AvailabilityDay[] = Array.from({ length: 7 }, (_, day) => ({
  day, enabled: true, windows: [{ id: `w-${day}`, start: "16:00", end: "18:00" }],
}));
const routine: LearningRoutine = {
  id: "math-routine", subjectId: "mathematik", subject: "Mathematik", title: "Mathematik allgemein",
  sessionsPerWeek: 2, preferredSessionMinutes: 30, importance: 3, difficulty: 3,
  learningMethod: "interleaving", flexible: true, enabled: true,
};
const exam: Exam = {
  id: "math-test", subjectId: "mathematik", subject: "Mathematik", title: "Mathematiktest", type: "test",
  date: addDays(today, 5), size: "large", importance: 5, estimatedHours: 4, color: "#000",
  topics: [{ id: "algebra", name: "Algebra", confidence: 2 }], learningMethod: "active-recall",
};

describe("QECore v1.08 integration contract", () => {
  it("plans a twice-weekly routine on distinct days", () => {
    const plan = generateStudyPlan({ availability, exams: [], routines: [routine], now: today });
    const dates = new Set(plan.sessions.filter((session) => session.routineId === routine.id).map((session) => session.date));
    expect(dates.size).toBeGreaterThanOrEqual(2);
  });

  it("counts same-subject exam work and avoids duplicate routine work before the test", () => {
    const plan = generateStudyPlan({ availability, exams: [exam], routines: [routine], now: today });
    const beforeExam = plan.sessions.filter((session) => session.date < exam.date);
    expect(new Set(beforeExam.filter((session) => session.routineCreditIds?.includes(routine.id)).map((session) => session.date)).size).toBeGreaterThanOrEqual(2);
    expect(beforeExam.some((session) => session.routineId === routine.id)).toBe(false);
  });

  it("validates shapes, respects masks and falls back on invalid output", async () => {
    const observation = {
      targets: new Float32Array(QECORE_V108.maxTargets * QECORE_V108.targetFeatures),
      globals: new Float32Array(QECORE_V108.globalFeatures),
      actionMask: new Uint8Array(QECORE_V108.maxTargets + 1),
    };
    observation.actionMask[0] = 1; observation.actionMask[2] = 1;
    expect(validateQECoreObservation(observation)).toBe(true);
    const selected = await selectQECoreAction(observation, async () => ({ logits: Float32Array.from([0, 99, 2, ...Array(10).fill(-1)]), value: 0 }));
    expect(selected).toEqual({ action: 2, fallback: false });
    const fallback = await selectQECoreAction(observation, async () => ({ logits: new Float32Array(1), value: Number.NaN }));
    expect(fallback.fallback).toBe(true);
  });
});
