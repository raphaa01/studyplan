"use client";

import { useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { SessionCard } from "@/components/session-card";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/components/providers/study-provider";
import { addDays, formatGermanDate, startOfToday } from "@/lib/planner";
import { minutesLabel } from "@/lib/format";

export default function PlanPage() {
  const { plan, exams, optimizePlan } = useStudy();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const start = addDays(startOfToday(), weekOffset * 7);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(start, index)), [start]);
  const selectedDay = days[selectedIndex];
  const sessions = plan.sessions.filter((session) => session.date === selectedDay);
  const learning = sessions.filter((session) => session.type !== "break");
  const dayExams = exams.filter((exam) => exam.date === selectedDay);
  const dayMinutes = learning.reduce((sum, session) => sum + session.duration, 0);

  function moveWeek(direction: number) { setWeekOffset((value) => value + direction); setSelectedIndex(0); }

  return <>
    <PageHeading eyebrow="Lernplan" title="Eine Woche, sieben klare Tage." description="Wähle einen Tag und sieh nur, was dann wirklich zählt." actions={<Button variant="secondary" onClick={optimizePlan}><RefreshCw size={16} />Plan aktualisieren</Button>} />
    <section className="plan-overview">
      <div className="plan-week-nav"><button aria-label="Vorherige Woche" onClick={() => moveWeek(-1)}><ChevronLeft size={18} /></button><span><small>Woche</small><strong>{formatGermanDate(days[0])} – {formatGermanDate(days[6])}</strong></span><button aria-label="Nächste Woche" onClick={() => moveWeek(1)}><ChevronRight size={18} /></button></div>
      <div className="plan-day-strip">{days.map((day, index) => { const dayLearning = plan.sessions.filter((session) => session.date === day && session.type !== "break"); const minutes = dayLearning.reduce((sum, session) => sum + session.duration, 0); const hasExam = exams.some((exam) => exam.date === day); return <button key={day} className={selectedIndex === index ? "active" : ""} onClick={() => setSelectedIndex(index)}><span>{formatGermanDate(day, { weekday: "short" })}</span><strong>{new Date(`${day}T12:00:00`).getDate()}</strong><small>{minutes ? minutesLabel(minutes) : "frei"}</small>{hasExam && <i />}</button>; })}</div>
    </section>

    <div className="agenda-layout">
      <aside className="agenda-summary"><p className="eyebrow">{formatGermanDate(selectedDay, { weekday: "long" })}</p><h2>{formatGermanDate(selectedDay, { day: "numeric", month: "long" })}</h2><div className="agenda-stat"><strong>{learning.length}</strong><span>Lernblöcke</span></div><div className="agenda-stat"><strong>{minutesLabel(dayMinutes)}</strong><span>aktive Lernzeit</span></div>{dayExams.length > 0 && <div className="agenda-exam-note"><CalendarRange size={17} /><span><strong>Prüfungstag</strong>{dayExams.map((exam) => exam.subject).join(", ")}</span></div>}</aside>
      <section className="agenda-panel"><div className="agenda-panel-head"><div><h2>Tagesablauf</h2><p>{learning.length ? "Pausen sind bereits eingerechnet." : "Heute bleibt bewusst frei."}</p></div></div><div className="agenda-list">{sessions.length ? sessions.map((session) => <div className="agenda-item" key={session.id}><span className="agenda-time">{session.startTime}</span><SessionCard session={session} /></div>) : <div className="agenda-empty"><span>Freier Tag</span><h3>Zeit zum Erholen.</h3><p>Ein guter Plan muss nicht jeden verfügbaren Tag füllen.</p></div>}</div></section>
    </div>
  </>;
}
