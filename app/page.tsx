"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CalendarDays, Check, CheckCircle2, Coffee, ListTodo, MapPin, RefreshCw, Target } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { SessionCard } from "@/components/session-card";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/components/providers/study-provider";
import { dateLabel, daysUntil, minutesLabel } from "@/lib/format";
import { addDays, startOfToday, timeFromMinutes } from "@/lib/planner";
import { buildDayTimeline, currentPhase } from "@/lib/planner/current-phase";

export default function Dashboard() {
  const { exams, plan, preferences, calendarItems, optimizePlan, skipSession, completeCalendarItem } = useStudy();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  const today = startOfToday();
  const weekEnd = addDays(today, 6);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const learning = plan.sessions.filter((session) => session.type !== "break");
  const todaySessions = plan.sessions.filter((session) => session.date === today);
  const todayItems = calendarItems.filter((item) => item.date === today);
  const timeline = useMemo(() => buildDayTimeline(today, todaySessions, todayItems), [today, todayItems, todaySessions]);
  const { active, next } = currentPhase(timeline, nowMinutes);
  const todayLearningMinutes = todaySessions.filter((session) => session.type !== "break").reduce((sum, session) => sum + session.duration, 0);
  const weekSessions = learning.filter((session) => session.date >= today && session.date <= weekEnd);
  const weekMinutes = weekSessions.reduce((sum, session) => sum + session.duration, 0);
  const weekCompleted = weekSessions.filter((session) => session.status === "completed");
  const overdue = learning.filter((session) => session.status === "planned" && session.date < today);
  const nextExam = [...exams].filter((exam) => exam.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const completion = weekSessions.length ? Math.round(weekCompleted.length / weekSessions.length * 100) : 0;
  const activeLearning = active?.kind === "session" && active.session.type !== "break" ? active.session : null;
  const activeCalendar = active?.kind === "calendar" ? active.item : null;

  return <>
    <PageHeading eyebrow={dateLabel(today, true)} title={`Hallo ${preferences.name || "Alex"}, das ist heute wichtig.`} description={`${minutesLabel(todayLearningMinutes)} Lernzeit · ${todayItems.length} eigene ${todayItems.length === 1 ? "Einplanung" : "Einplanungen"}`} actions={<button className="button button-quiet" onClick={optimizePlan}><RefreshCw size={15} />Neu planen</button>} />
    {overdue.length > 0 && <section className="missed-banner"><AlertCircle size={19} /><div><strong>{overdue.length === 1 ? "Eine Einheit ist noch offen." : `${overdue.length} Einheiten sind noch offen.`}</strong><p>Plane sie neu ein oder überspringe sie bewusst.</p></div><div><button className="button button-ghost" onClick={() => overdue.forEach((session) => skipSession(session.id))}>Überspringen</button><button className="button button-secondary" onClick={optimizePlan}>Neu verteilen</button></div></section>}

    <div className="focus-layout">
      <section className="focus-card">
        <div className="focus-card-head"><span className="live-dot" /><span>Jetzt · {timeFromMinutes(nowMinutes)}</span>{active && <span className="focus-date">bis {timeFromMinutes(active.end)}</span>}</div>
        {activeLearning ? <div className="focus-action"><SessionCard session={activeLearning} featured /></div> : activeCalendar ? <div className="focus-personal"><span>{activeCalendar.kind === "appointment" ? <MapPin size={16} /> : <ListTodo size={16} />}{activeCalendar.kind === "appointment" ? "Termin" : "To-do"}</span><h2>{activeCalendar.title}</h2><p>{activeCalendar.notes || `Eingeplant bis ${timeFromMinutes(active?.end ?? nowMinutes)}`}</p>{activeCalendar.status === "completed" ? <span className="hero-done"><Check size={16} />Erledigt</span> : <Button onClick={() => completeCalendarItem(activeCalendar.id)}>Als erledigt markieren</Button>}</div> : <div className="focus-pause"><Coffee size={28} /><span>Freier Zeitraum</span><h2>Pause.</h2><p>{next ? `Als Nächstes um ${timeFromMinutes(next.start)}: ${next.kind === "calendar" ? next.item.title : next.session.type === "break" ? "Pause" : next.session.title}` : "Für heute steht nichts mehr an."}</p></div>}
      </section>
      <aside className="focus-side">
        <section className="next-exam-card"><div className="card-label"><Target size={15} />Nächste Prüfung</div>{nextExam ? <><span className="exam-subject-line"><i style={{ background: nextExam.color }} />{nextExam.subject}</span><h3>{nextExam.title}</h3><div className="countdown-large"><strong>{daysUntil(nextExam.date)}</strong><span>Tage</span></div><p>{nextExam.topics.length} Themen · {dateLabel(nextExam.date)}</p><Link href="/exams" className="text-link">Prüfung ansehen <ArrowRight size={14} /></Link></> : <><h3>Keine Prüfung geplant</h3><Link href="/exams/new" className="text-link">Prüfung hinzufügen <ArrowRight size={14} /></Link></>}</section>
        <section className="week-progress-card"><div><span>Diese Woche</span><strong>{completion}%</strong></div><div className="week-progress-track"><span style={{ width: `${completion}%` }} /></div><p>{minutesLabel(weekMinutes)} geplant · {weekCompleted.length} erledigt</p></section>
      </aside>
    </div>

    <section className="up-next-section"><div className="section-heading"><div><p className="eyebrow">Heute</p><h2>Dein Tagesablauf</h2></div><Link href="/plan" className="button button-secondary"><CalendarDays size={16} />Wochenplan öffnen</Link></div>
      <div className="today-timeline-list">{timeline.length ? timeline.map((entry) => <div className={`today-timeline-row ${entry === active ? "current" : ""}`} key={entry.kind === "calendar" ? entry.item.id : entry.session.id}><span className="today-timeline-time">{timeFromMinutes(entry.start)}</span>{entry.kind === "session" ? <SessionCard session={entry.session} compact /> : <article className={`today-personal-row ${entry.item.status === "completed" ? "done" : ""}`}><span className={`personal-kind ${entry.item.kind}`}>{entry.item.kind === "appointment" ? <MapPin size={14} /> : <ListTodo size={14} />}</span><div><small>{entry.item.kind === "appointment" ? "Termin" : "To-do"} · {entry.item.duration} min</small><strong>{entry.item.title}</strong></div>{entry.item.status === "completed" ? <span className="done-label"><CheckCircle2 size={16} />Erledigt</span> : <Button variant="secondary" onClick={() => completeCalendarItem(entry.item.id)}>Erledigt</Button>}</article>}</div>) : <div className="empty-state"><CheckCircle2 size={25} /><h3>Heute ist frei</h3><p>Im Wochenplan kannst du jederzeit Termine oder To-dos ergänzen.</p></div>}</div>
    </section>
  </>;
}
