"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BrainCircuit, CalendarPlus, ChevronLeft, ChevronRight, ListTodo, MapPin, Play, RefreshCw } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { SessionCard } from "@/components/session-card";
import { CalendarItemForm } from "@/components/calendar-item-form";
import { WeekTimeline } from "@/components/week-timeline";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/components/providers/study-provider";
import { addDays, formatGermanDate, startOfToday, startOfWeek } from "@/lib/planner";
import { minutesLabel } from "@/lib/format";

export default function PlanPage() {
  const { plan, exams, calendarItems, optimizePlan, completeCalendarItem, removeCalendarItem, plannerStatus, plannerReason } = useStudy();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(startOfToday());
  const [formOpen, setFormOpen] = useState(false);
  const start = addDays(startOfWeek(), weekOffset * 7);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(start, index)), [start]);
  const selectedSessions = plan.sessions.filter((session) => session.date === selectedDay);
  const selectedItems = calendarItems.filter((item) => item.date === selectedDay).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const dayMinutes = selectedSessions.filter((session) => session.type !== "break").reduce((sum, session) => sum + session.duration, 0);

  function moveWeek(direction: number) {
    const nextStart = addDays(start, direction * 7);
    setWeekOffset((value) => value + direction);
    setSelectedDay(nextStart);
  }

  return <>
    <PageHeading eyebrow="Wochenplan" title="Deine Woche – auf einen Blick." description="Lernblöcke, Pausen, Termine und To-dos liegen in einer gemeinsamen Zeitachse." actions={<><Button variant="secondary" disabled={plannerStatus === "loading"} onClick={optimizePlan}><RefreshCw className={plannerStatus === "loading" ? "is-spinning" : ""} size={16} />{plannerStatus === "loading" ? "Plant …" : "Optimieren"}</Button><Button onClick={() => setFormOpen(true)}><CalendarPlus size={16} />Termin oder To-do</Button></>} />
    <div className="plan-toolbar-row">
      <section className="week-toolbar"><button aria-label="Vorherige Woche" onClick={() => moveWeek(-1)}><ChevronLeft size={18} /></button><div><small>Woche</small><strong>{formatGermanDate(days[0], { day: "2-digit", month: "short" })} – {formatGermanDate(days[6], { day: "2-digit", month: "short", year: "numeric" })}</strong></div><button aria-label="Nächste Woche" onClick={() => moveWeek(1)}><ChevronRight size={18} /></button><button className="today-link" onClick={() => { setWeekOffset(0); setSelectedDay(startOfToday()); }}>Heute</button></section>
      <span className={`planner-engine-status is-${plannerStatus}`} title={plannerReason ?? undefined} aria-live="polite"><BrainCircuit size={14} />{plannerStatus === "loading" ? "model-v007 plant lokal" : plannerStatus === "ready" ? "Geplant mit model-v007" : plannerStatus === "fallback" ? "Sicherer Basisplan" : "Lokale Planung"}</span>
    </div>
    <WeekTimeline days={days} sessions={plan.sessions} exams={exams} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
    <section className="day-detail-panel"><div className="day-detail-head"><div><p className="eyebrow">{formatGermanDate(selectedDay, { weekday: "long" })}</p><h2>{formatGermanDate(selectedDay, { day: "numeric", month: "long" })}</h2></div><span>{minutesLabel(dayMinutes)} Lernzeit · {selectedItems.length} eigene Einträge</span></div>
      <div className="day-detail-list">{[...selectedSessions.map((session) => ({ time: session.startTime, node: <SessionCard key={session.id} session={session} /> })), ...selectedItems.map((item) => ({ time: item.startTime, node: <article key={item.id} className={`personal-agenda-item ${item.status === "completed" ? "done" : ""}`}><div>{item.kind === "appointment" ? <MapPin size={16} /> : <ListTodo size={16} />}</div><span><small>{item.kind === "appointment" ? "Termin" : "To-do"}</small><strong>{item.title}</strong>{item.notes && <p>{item.notes}</p>}</span><div className="personal-actions">{item.status !== "completed" && item.kind === "todo" && <Link className="button button-secondary" href={`/todo/${item.id}`}><Play size={14} />Fokus</Link>}{item.status !== "completed" && <Button variant="ghost" onClick={() => completeCalendarItem(item.id)}>Erledigt</Button>}<button aria-label="Eintrag löschen" onClick={() => removeCalendarItem(item.id)}>Löschen</button></div></article> }))].sort((a, b) => a.time.localeCompare(b.time)).map((entry, index) => <div className="agenda-item" key={`${entry.time}-${index}`}><span className="agenda-time">{entry.time}</span>{entry.node}</div>)}</div>
    </section>
    <CalendarItemForm key={`${selectedDay}-${formOpen}`} open={formOpen} defaultDate={selectedDay} onClose={() => setFormOpen(false)} />
  </>;
}
