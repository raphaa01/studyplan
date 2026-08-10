"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Clock3, RefreshCw, Target } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { SessionCard } from "@/components/session-card";
import { useStudy } from "@/components/providers/study-provider";
import { dateLabel, daysUntil, minutesLabel } from "@/lib/format";
import { addDays, startOfToday } from "@/lib/planner";

export default function Dashboard() {
  const { exams, plan, preferences, optimizePlan, skipSession } = useStudy();
  const today = startOfToday();
  const weekEnd = addDays(today, 6);
  const learning = plan.sessions.filter((session) => session.type !== "break");
  const planned = learning.filter((session) => session.status === "planned" && session.date >= today).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const focusSession = planned[0];
  const queue = planned.slice(1, 4);
  const weekSessions = learning.filter((session) => session.date >= today && session.date <= weekEnd);
  const weekMinutes = weekSessions.reduce((sum, session) => sum + session.duration, 0);
  const weekCompleted = weekSessions.filter((session) => session.status === "completed");
  const overdue = learning.filter((session) => session.status === "planned" && session.date < today);
  const nextExam = [...exams].filter((exam) => exam.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const completion = weekSessions.length ? Math.round(weekCompleted.length / weekSessions.length * 100) : 0;
  const focusLabel = focusSession?.date === today ? "Heute als Nächstes" : focusSession ? dateLabel(focusSession.date, true) : "Heute";

  return <>
    <PageHeading eyebrow={dateLabel(today, true)} title={`Hallo ${preferences.name || "Alex"}, was steht an?`} description="Ein klarer nächster Schritt. Mehr musst du gerade nicht im Kopf behalten." actions={<button className="button button-quiet" onClick={optimizePlan}><RefreshCw size={15} />Neu planen</button>} />
    {overdue.length > 0 && <section className="missed-banner"><AlertCircle size={19} /><div><strong>{overdue.length === 1 ? "Eine Einheit ist noch offen." : `${overdue.length} Einheiten sind noch offen.`}</strong><p>Plane sie neu ein oder überspringe sie bewusst.</p></div><div><button className="button button-ghost" onClick={() => overdue.forEach((session) => skipSession(session.id))}>Überspringen</button><button className="button button-secondary" onClick={optimizePlan}>Neu verteilen</button></div></section>}

    <div className="focus-layout">
      <section className="focus-card">
        <div className="focus-card-head"><span className="live-dot" /><span>{focusLabel}</span>{focusSession && <span className="focus-date">{focusSession.startTime} · {focusSession.duration} min</span>}</div>
        {focusSession ? <div className="focus-action"><SessionCard session={focusSession} featured /></div> : <div className="focus-empty"><CheckCircle2 size={30} /><h2>Für heute ist alles geschafft.</h2><p>Der Plan lässt dir bewusst Zeit zum Abschalten.</p></div>}
      </section>
      <aside className="focus-side">
        <section className="next-exam-card"><div className="card-label"><Target size={15} />Nächste Prüfung</div>{nextExam ? <><span className="exam-subject-line"><i style={{ background: nextExam.color }} />{nextExam.subject}</span><h3>{nextExam.title}</h3><div className="countdown-large"><strong>{daysUntil(nextExam.date)}</strong><span>Tage</span></div><p>{nextExam.topics.length} Themen · {dateLabel(nextExam.date)}</p><Link href="/exams" className="text-link">Prüfung ansehen <ArrowRight size={14} /></Link></> : <><h3>Keine Prüfung geplant</h3><Link href="/exams/new" className="text-link">Prüfung hinzufügen <ArrowRight size={14} /></Link></>}</section>
        <section className="week-progress-card"><div><span>Diese Woche</span><strong>{completion}%</strong></div><div className="week-progress-track"><span style={{ width: `${completion}%` }} /></div><p>{minutesLabel(weekMinutes)} geplant · {weekCompleted.length} erledigt</p></section>
      </aside>
    </div>

    <section className="up-next-section"><div className="section-heading"><div><p className="eyebrow">Danach</p><h2>Deine nächsten Schritte</h2></div><Link href="/plan" className="button button-secondary"><CalendarDays size={16} />Ganzen Plan öffnen</Link></div>
      <div className="next-session-list">{queue.length ? queue.map((session) => <div className="next-session-row" key={session.id}><span className="next-session-day">{session.date === today ? "Heute" : dateLabel(session.date)}</span><SessionCard session={session} compact /></div>) : <div className="empty-state"><Clock3 size={25} /><h3>Keine weiteren Einheiten</h3><p>Füge eine Prüfung hinzu oder passe deine Lernzeiten an.</p></div>}</div>
    </section>
  </>;
}
