import { describe, expect, it } from "vitest";
import { createLearningProgress, createLearningSessionContent, remainingLearningSeconds } from "@/lib/learning-session";
import type { Exam, StudySession } from "@/types/study";

const session: StudySession = { id: "session-1", examId: "exam-1", topicId: "topic-1", date: "2026-08-12", startTime: "16:00", duration: 25, type: "practice", title: "Extrempunkte · Üben", description: "Vier Aufgaben ohne Hilfe lösen.", status: "planned", rationale: "", intensity: "medium", sequence: 1 };
const exam: Exam = { id: "exam-1", subject: "Mathematik", title: "Mathematik Klausur", type: "exam", date: "2026-08-20", size: "large", importance: 5, estimatedHours: null, color: "#47624b", topics: [{ id: "topic-1", name: "Extrempunkte", confidence: 2 }], learningMethod: "interleaving" };

describe("guided learning session", () => {
  it("creates concrete quantitative tasks, recall prompts and cards", () => {
    const content = createLearningSessionContent(session, exam, exam.topics[0]);
    expect(content.tasks).toHaveLength(4);
    expect(content.tasks.some((task) => task.text.includes("Formeln"))).toBe(true);
    expect(content.recall).toHaveLength(3);
    expect(content.cards).toHaveLength(3);
  });

  it("creates a paused progress record for the full session duration", () => {
    const progress = createLearningProgress(session, new Date("2026-08-12T14:00:00.000Z"));
    expect(progress.remainingSeconds).toBe(1500);
    expect(progress.runningSince).toBeNull();
    expect(progress.stage).toBe(0);
  });

  it("derives remaining time from the persisted start timestamp", () => {
    const progress = { ...createLearningProgress(session), runningSince: "2026-08-12T14:00:00.000Z" };
    expect(remainingLearningSeconds(progress, new Date("2026-08-12T14:04:10.000Z").getTime())).toBe(1250);
  });

  it("never returns a negative timer value", () => {
    const progress = { ...createLearningProgress(session), runningSince: "2026-08-12T14:00:00.000Z" };
    expect(remainingLearningSeconds(progress, new Date("2026-08-12T15:00:00.000Z").getTime())).toBe(0);
  });
});
