"use client";

import Link from "next/link";
import { Check, ListTodo, MapPin, Play, Trash2 } from "lucide-react";
import { formatGermanDate, minutesFromTime, timeFromMinutes } from "@/lib/planner";
import type { CalendarItem, Exam, StudySession } from "@/types/study";
import { useStudy } from "./providers/study-provider";

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_HEIGHT = 58;

export function WeekTimeline({ days, sessions, exams, selectedDay, onSelectDay }: { days: string[]; sessions: StudySession[]; exams: Exam[]; selectedDay: string; onSelectDay: (day: string) => void }) {
  const { calendarItems, removeCalendarItem } = useStudy();
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index);
  const gridHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const entryCounts = new Map(days.map((day) => [day, 0]));
  for (const session of sessions) if (entryCounts.has(session.date)) entryCounts.set(session.date, (entryCounts.get(session.date) ?? 0) + 1);
  for (const item of calendarItems) if (entryCounts.has(item.date)) entryCounts.set(item.date, (entryCounts.get(item.date) ?? 0) + 1);

  return <div className="week-timeline-shell">
    <div className="week-timeline-header" aria-label="Tag auswählen"><span />{days.map((day) => {
      const entryCount = entryCounts.get(day) ?? 0;
      return <button key={day} aria-pressed={day === selectedDay} aria-label={`${formatGermanDate(day, { weekday: "long", day: "numeric", month: "long" })}, ${entryCount ? `${entryCount} Einträge` : "frei"}`} className={day === selectedDay ? "active" : ""} onClick={() => onSelectDay(day)}><span>{formatGermanDate(day, { weekday: "short" })}</span><strong>{formatGermanDate(day, { day: "2-digit" })}</strong>{entryCount > 0 && <i aria-hidden="true" />}</button>;
    })}</div>
    <div className="week-timeline-scroll">
      <div className="week-time-axis" style={{ height: gridHeight }}>{hours.slice(0, -1).map((hour) => <span key={hour} style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}>{timeFromMinutes(hour * 60)}</span>)}</div>
      <div className="week-columns">{days.map((day) => {
        const entries = [
          ...sessions.filter((session) => session.date === day).map((session) => ({ type: "session" as const, startTime: session.startTime, duration: session.duration, session })),
          ...calendarItems.filter((item) => item.date === day).map((item) => ({ type: "calendar" as const, startTime: item.startTime, duration: item.duration, item })),
        ].sort((a, b) => a.startTime.localeCompare(b.startTime));
        return <div className={`week-day-column ${day === selectedDay ? "selected" : ""}`} key={day} style={{ height: gridHeight }}>{hours.slice(0, -1).map((hour) => <i key={hour} style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }} />)}
          {exams.filter((exam) => exam.date === day).map((exam) => <div className="week-exam-marker" key={exam.id} style={{ borderColor: exam.color }}>{exam.time ?? "Prüfung"} · {exam.subject}</div>)}
          {entries.map((entry) => {
            const top = (minutesFromTime(entry.startTime) - START_HOUR * 60) / 60 * HOUR_HEIGHT;
            const height = Math.max(24, entry.duration / 60 * HOUR_HEIGHT - 2);
            if (top + height < 0 || top > gridHeight) return null;
            if (entry.type === "calendar") return <CalendarBlock key={entry.item.id} item={entry.item} top={top} height={height} onRemove={() => removeCalendarItem(entry.item.id)} />;
            const exam = exams.find((item) => item.id === entry.session.examId);
            return <div key={entry.session.id} className={`week-block week-session-block ${entry.session.type === "break" ? "week-break-block" : ""} ${entry.session.status === "completed" ? "done" : ""}`} style={{ top, height, "--subject-color": exam?.color ?? "#aeb4aa" } as React.CSSProperties}><span>{entry.startTime}</span><strong>{entry.session.type === "break" ? "Pause" : exam?.subject}</strong>{height > 43 && <small>{entry.session.title}</small>}</div>;
          })}
        </div>;
      })}</div>
    </div>
  </div>;
}

function CalendarBlock({ item, top, height, onRemove }: { item: CalendarItem; top: number; height: number; onRemove: () => void }) {
  return <div className={`week-block week-personal-block ${item.kind} ${item.status === "completed" ? "done" : ""}`} style={{ top, height }}>
    <span>{item.startTime}</span><strong>{item.kind === "appointment" ? <MapPin size={11} /> : <ListTodo size={11} />}{item.title}</strong>{item.status === "completed" && <Check size={12} />}
    {item.kind === "todo" && item.status !== "completed" && height > 42 && <Link className="week-todo-focus" aria-label={`${item.title} fokussiert bearbeiten`} href={`/todo/${item.id}`}><Play size={10} />Fokus</Link>}
    <button aria-label={`${item.title} löschen`} onClick={(event) => { event.stopPropagation(); onRemove(); }}><Trash2 size={12} /></button>
  </div>;
}
