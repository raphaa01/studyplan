import type { CalendarItem, StudySession } from "@/types/study";
import { minutesFromTime, timeFromMinutes } from "./date-utils";

export function addBreaks(sessions: StudySession[], calendarItems: CalendarItem[] = []): StudySession[] {
  const byWindow = [...sessions].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const result: StudySession[] = [];
  let consecutive = 0;
  for (let index = 0; index < byWindow.length; index += 1) {
    const session = byWindow[index];
    result.push(session);
    consecutive += 1;
    const next = byWindow[index + 1];
    if (!next || next.date !== session.date) {
      consecutive = 0;
      continue;
    }
    const end = minutesFromTime(session.startTime) + session.duration;
    const gap = minutesFromTime(next.startTime) - end;
    const blocked = calendarItems.some((item) => item.date === session.date
      && minutesFromTime(item.startTime) < minutesFromTime(next.startTime)
      && minutesFromTime(item.startTime) + item.duration > end);
    if (!blocked && gap >= 5 && gap <= 35) {
      const duration = consecutive >= 3 ? Math.min(gap, 20) : Math.min(gap, 10);
      result.push({
        id: `break-${session.id}`,
        examId: null,
        topicId: null,
        date: session.date,
        startTime: timeFromMinutes(end),
        duration,
        type: "break",
        title: consecutive >= 3 ? "Längere Pause" : "Pause",
        description: consecutive >= 3 ? "Bewegen, trinken und den Kopf bewusst freimachen." : "Kurz aufstehen und den Blick in die Ferne richten.",
        status: "planned",
        rationale: "Pausen schützen Konzentration und reduzieren kognitive Ermüdung.",
        intensity: "light",
        sequence: session.sequence + 0.5,
      });
      if (consecutive >= 3) consecutive = 0;
    }
  }
  return result;
}
