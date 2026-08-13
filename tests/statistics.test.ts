import { describe, expect, it } from "vitest";
import { appendActivityRecord, backfillActivityLog, buildStatistics, createTodoActivity } from "@/lib/statistics";
import type { ActivityRecord, CalendarItem, Exam, StudySession, StudySessionFeedback } from "@/types/study";

const records: ActivityRecord[] = [
  { id: "study-1", sourceId: "session-1", kind: "study", title: "Ableitungen üben", subject: "Mathematik", durationMinutes: 45, completedAt: "2026-08-03T16:45:00.000Z" },
  { id: "study-2", sourceId: "session-2", kind: "study", title: "DNA abrufen", subject: "Biologie", durationMinutes: 30, completedAt: "2026-08-10T17:00:00.000Z" },
  { id: "todo-1", sourceId: "todo-1", kind: "todo", title: "Formelsammlung", durationMinutes: 25, completedAt: "2026-08-11T18:00:00.000Z" },
];

describe("statistics", () => {
  it("counts learning time, completed sessions and todos separately", () => {
    const result = buildStatistics(records, "12-weeks", new Date("2026-08-13T12:00:00.000Z"));
    expect(result.totalStudyMinutes).toBe(75);
    expect(result.completedStudySessions).toBe(2);
    expect(result.completedTodos).toBe(1);
    expect(result.averageSessionMinutes).toBe(38);
    expect(result.activeDays).toBe(3);
  });

  it("groups activity into a twelve-week timeline", () => {
    const result = buildStatistics(records, "12-weeks", new Date("2026-08-13T12:00:00.000Z"));
    expect(result.timeline).toHaveLength(12);
    expect(result.timeline.reduce((sum, point) => sum + point.studyMinutes, 0)).toBe(75);
    expect(result.timeline.reduce((sum, point) => sum + point.todoCount, 0)).toBe(1);
  });

  it("keeps one permanent record per source item", () => {
    const todo: CalendarItem = { id: "todo-2", title: "Referat", date: "2026-08-13", startTime: "17:00", duration: 45, kind: "todo", status: "planned" };
    const record = createTodoActivity(todo, "2026-08-13T18:00:00.000Z");
    expect(appendActivityRecord([record], record)).toHaveLength(1);
  });

  it("backfills legacy completed sessions and todos", () => {
    const exam: Exam = { id: "exam-1", subject: "Mathematik", title: "Klausur", type: "exam", date: "2026-08-20", size: "medium", importance: 4, estimatedHours: null, color: "#47624b", topics: [], learningMethod: "auto" };
    const session: StudySession = { id: "session-legacy", examId: exam.id, topicId: null, date: "2026-08-01", startTime: "16:00", duration: 40, type: "practice", title: "Aufgaben", description: "", status: "completed", rationale: "", intensity: "medium", sequence: 1 };
    const feedback: StudySessionFeedback = { sessionId: session.id, difficulty: "okay", confidence: 3, completedAt: "2026-08-01T17:00:00.000Z" };
    const todo: CalendarItem = { id: "todo-legacy", title: "Notizen sortieren", date: "2026-08-02", startTime: "18:00", duration: 20, kind: "todo", status: "completed" };
    const log = backfillActivityLog(undefined, [session], [exam], [feedback], [todo]);
    expect(log).toHaveLength(2);
    expect(log[0].subject).toBe("Mathematik");
    expect(log[1].kind).toBe("todo");
  });
});
