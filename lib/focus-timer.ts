import type { CalendarItem, TodoFocusProgress } from "@/types/study";

type PersistedTimer = Pick<TodoFocusProgress, "remainingSeconds" | "runningSince">;

export function createTodoFocusProgress(item: CalendarItem, now = new Date()): TodoFocusProgress {
  return {
    itemId: item.id,
    remainingSeconds: item.duration * 60,
    runningSince: null,
    updatedAt: now.toISOString(),
  };
}

export function remainingFocusSeconds(progress: PersistedTimer, nowMs = Date.now()): number {
  if (!progress.runningSince) return Math.max(0, progress.remainingSeconds);
  const startedAt = new Date(progress.runningSince).getTime();
  if (!Number.isFinite(startedAt)) return Math.max(0, progress.remainingSeconds);
  const elapsed = Math.max(0, Math.floor((nowMs - startedAt) / 1000));
  return Math.max(0, progress.remainingSeconds - elapsed);
}

export function formatFocusTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
