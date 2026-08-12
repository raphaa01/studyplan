import { describe, expect, it } from "vitest";
import { createTodoFocusProgress, formatFocusTime, remainingFocusSeconds } from "@/lib/focus-timer";
import type { CalendarItem } from "@/types/study";

const todo: CalendarItem = { id: "todo-1", title: "Referat fertigstellen", date: "2026-08-12", startTime: "16:00", duration: 25, kind: "todo", status: "planned" };

describe("todo focus timer", () => {
  it("starts paused with the todo duration", () => {
    const progress = createTodoFocusProgress(todo, new Date("2026-08-12T14:00:00.000Z"));
    expect(progress).toMatchObject({ itemId: "todo-1", remainingSeconds: 1500, runningSince: null });
  });

  it("keeps counting from its persisted timestamp", () => {
    const progress = { ...createTodoFocusProgress(todo), runningSince: "2026-08-12T14:00:00.000Z" };
    expect(remainingFocusSeconds(progress, new Date("2026-08-12T14:03:20.000Z").getTime())).toBe(1300);
  });

  it("handles invalid timestamps without losing time", () => {
    const progress = { ...createTodoFocusProgress(todo), runningSince: "invalid" };
    expect(remainingFocusSeconds(progress)).toBe(1500);
  });

  it("formats long and short focus periods", () => {
    expect(formatFocusTime(65)).toBe("01:05");
    expect(formatFocusTime(3605)).toBe("60:05");
  });
});
