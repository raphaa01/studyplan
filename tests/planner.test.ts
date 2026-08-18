import { describe, expect, it } from "vitest";
import { generateStudyPlan } from "@/lib/planner";
import { examPriority } from "@/lib/planner/priority";
import { addDays } from "@/lib/planner/date-utils";
import { buildDayTimeline, currentPhase } from "@/lib/planner/current-phase";
import type { AvailabilityDay, CalendarItem, Exam, LearningRoutine, StudySession } from "@/types/study";

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
  learningMethod: "auto",
  topics: [{ id: "topic-low", name: "Extrempunkte", confidence: 2 }],
  ...patch,
});
const makeRoutine = (patch: Partial<LearningRoutine> = {}): LearningRoutine => ({
  id: "math-routine", subjectId: "mathematik", subject: "Mathematik", title: "Mathematik regelmäßig lernen",
  weeklyMinutes: 60, schedulingMode: "fixed", fixedSlots: [
    { id: "monday", day: 1, startTime: "15:00" },
    { id: "thursday", day: 4, startTime: "18:30" },
  ],
  sessionsPerWeek: 2, preferredSessionMinutes: 30, importance: 2, difficulty: 3,
  learningMethod: "auto", flexible: false, enabled: true,
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

  it("keeps learning sessions out of a fixed appointment", () => {
    const appointment: CalendarItem = { id: "appointment", title: "Training", date: today, startTime: "16:45", duration: 60, kind: "appointment", status: "planned" };
    const plan = generateStudyPlan({ availability: allDays("16:00", "19:00"), exams: [makeExam({ size: "very-large" })], calendarItems: [appointment], now: today });
    const overlaps = plan.sessions.filter((session) => session.date === today).filter((session) => {
      const start = Number(session.startTime.slice(0, 2)) * 60 + Number(session.startTime.slice(3));
      return start < 17 * 60 + 45 && start + session.duration > 16 * 60 + 45;
    });
    expect(overlaps).toHaveLength(0);
    expect(plan.sessions.some((session) => session.date === today && session.startTime >= "17:45")).toBe(true);
  });

  it("shows a pause after an expired task instead of keeping it current", () => {
    const session: StudySession = { id: "past", examId: "exam-1", topicId: "topic-low", date: today, startTime: "15:10", duration: 50, type: "practice", title: "Aufgabe", description: "", status: "planned", rationale: "", intensity: "medium", sequence: 1 };
    const timeline = buildDayTimeline(today, [session], []);
    const phase = currentPhase(timeline, 16 * 60 + 15);
    expect(phase.active).toBeUndefined();
    expect(phase.isPause).toBe(true);
  });

  it("uses 25-minute focus blocks for Pomodoro", () => {
    const plan = generateStudyPlan({ availability: allDays(), exams: [makeExam({ learningMethod: "pomodoro" })], now: today });
    const learning = plan.sessions.filter((session) => session.type !== "break");
    expect(learning.length).toBeGreaterThan(0);
    expect(learning.every((session) => session.duration <= 25)).toBe(true);
  });

  it("places a weekly routine at each chosen fixed appointment", () => {
    const routine = makeRoutine();
    const plan = generateStudyPlan({ availability: allDays(), exams: [], routines: [routine], now: today });
    const sessions = plan.sessions.filter((session) => session.routineId === routine.id && session.type !== "break");
    expect(sessions.map((session) => `${session.date}:${session.startTime}`)).toEqual([
      `${today}:15:00`,
      `${addDays(today, 3)}:18:30`,
    ]);
    expect(sessions.reduce((sum, session) => sum + session.duration, 0)).toBe(60);
  });

  it("turns a fixed routine into same-subject exam preparation", () => {
    const routine = makeRoutine({ weeklyMinutes: 30, fixedSlots: [{ id: "monday", day: 1, startTime: "15:00" }], sessionsPerWeek: 1 });
    const plan = generateStudyPlan({ availability: allDays(), exams: [makeExam()], routines: [routine], now: today });
    const fixed = plan.sessions.find((session) => session.routineId === routine.id && session.startTime === "15:00");
    expect(fixed?.examId).toBe("exam-1");
    expect(fixed?.routineCreditIds).toContain(routine.id);
    expect(fixed?.duration).toBe(30);
  });
});
