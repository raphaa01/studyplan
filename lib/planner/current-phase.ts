import type { CalendarItem, StudySession } from "@/types/study";
import { minutesFromTime } from "./date-utils";

export type DayTimelineEntry =
  | { kind: "session"; start: number; end: number; session: StudySession }
  | { kind: "calendar"; start: number; end: number; item: CalendarItem };

export function buildDayTimeline(date: string, sessions: StudySession[], calendarItems: CalendarItem[]): DayTimelineEntry[] {
  return [
    ...sessions.filter((session) => session.date === date).map((session) => ({ kind: "session" as const, start: minutesFromTime(session.startTime), end: minutesFromTime(session.startTime) + session.duration, session })),
    ...calendarItems.filter((item) => item.date === date).map((item) => ({ kind: "calendar" as const, start: minutesFromTime(item.startTime), end: minutesFromTime(item.startTime) + item.duration, item })),
  ].sort((a, b) => a.start - b.start);
}

export function currentPhase(entries: DayTimelineEntry[], currentMinutes: number) {
  const active = entries.find((entry) => entry.start <= currentMinutes && currentMinutes < entry.end);
  const next = entries.find((entry) => entry.start > currentMinutes);
  return { active, next, isPause: !active || (active.kind === "session" && active.session.type === "break") };
}
