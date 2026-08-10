import { describe, expect, it } from "vitest";
import { generateStudyPlan } from "@/lib/planner";
import { examPriority } from "@/lib/planner/priority";
import { addDays } from "@/lib/planner/date-utils";
import type { AvailabilityDay, Exam, StudySession } from "@/types/study";

const today = "2026-08-10";
const allDays = (start = "16:00", end = "20:00"): AvailabilityDay[] => Array.from({ length: 7 }, (_, day) => ({ day, enabled: true, windows: [{ id: `window-${day}`, start, end }] }));
const makeExam = (patch: Partial<Exam> = {}): Exam => ({
  id: "exam-1",
  subject: "Mathematik",
  title: "Mathematik Klausur",
  type: "exam",
  date: addDays(today, 7),
  size: "medium",
  importance: 3,
  estimatedHours: null,
  color: "#47624b",
  topics: [{ id: "topic-low", name: "Extrempunkte", confidence: 2 }],
  ...patch,
});

describe("deterministic study planner", () => {
  it("gives an exam tomorrow substantially higher priority", () => {
    const tomorrow = makeExam({ date: addDays(today, 1) });
    const later = makeExam({ id: "later", date: addDays(today, 14) });
    expect(examPriority(tomorrow, today)).toBeGreaterThan(examPriority(later, today) * 2);
  });

  it("spreads a later exam across multiple days", () => {
    const plan = generateStudyPlan({ availability: allDays(), exams: [makeExam({ date: addDays(today, 14), size: "large" })], now: today });
    const dates = new Set(plan.sessions.filter((session) => session.examId === "exam-1").map((session) => session.date));
    expect(dates.size).toBeGreaterThanOrEqual(3);
  });

  it("allocates time to two simultaneous exams", () => {
    const exams = [makeExam(), makeExam({ id: "exam-2", subject: "Biologie", title: "Biologie Test", topics: [{ id: "bio", name: "DNA", confidence: 3 }] })];
    const plan = generateStudyPlan({ availability: allDays(), exams, now: today });
    expect(plan.sessions.some((session) => session.examId === "exam-1")).toBe(true);
    expect(plan.sessions.some((session) => session.examId === "exam-2")).toBe(true);
  });

  it("never creates a 60-minute session in a 30-minute window", () => {
    const plan = generateStudyPlan({ availability: allDays("16:00", "16:30"), exams: [makeExam()], now: today });
    const learning = plan.sessions.filter((session) => session.type !== "break");
    expect(learning.length).toBeGreaterThan(0);
    expect(Math.max(...learning.map((session) => session.duration))).toBeLessThanOrEqual(30);
  });

  it("adds visible breaks during a long availability window", () => {
    const exams = [makeExam({ size: "very-large" }), makeExam({ id: "exam-2", title: "Physik Klausur", subject: "Physik", size: "large", topics: [{ id: "physics", name: "Mechanik", confidence: 2 }] })];
    const plan = generateStudyPlan({ availability: allDays("14:00", "18:00"), exams, now: today });
    expect(plan.sessions.some((session) => session.type === "break")).toBe(true);
    expect(plan.sessions.filter((session) => session.type !== "break").every((session) => session.duration <= 60)).toBe(true);
  });

  it("repeats a low-confidence topic more than a mastered topic", () => {
    const exam = makeExam({ size: "very-large", topics: [{ id: "low", name: "Extrempunkte", confidence: 1 }, { id: "high", name: "Tangenten", confidence: 5 }] });
    const plan = generateStudyPlan({ availability: allDays(), exams: [exam], now: today });
    const count = (topicId: string) => plan.sessions.filter((session) => session.topicId === topicId).length;
    expect(count("low")).toBeGreaterThan(count("high"));
  });

  it("replans a missed session instead of preserving it", () => {
    const missed: StudySession = { id: "missed", examId: "exam-1", topicId: "topic-low", date: today, startTime: "16:00", duration: 45, type: "practice", title: "Alt", description: "Alt", status: "missed", rationale: "Alt", intensity: "medium", sequence: 1 };
    const plan = generateStudyPlan({ availability: allDays(), exams: [makeExam()], previousSessions: [missed], now: today });
    expect(plan.sessions.some((session) => session.id === "missed")).toBe(false);
    expect(plan.sessions.some((session) => session.examId === "exam-1")).toBe(true);
  });
});
