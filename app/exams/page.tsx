"use client";

import Link from "next/link";
import { BookOpenCheck, CalendarDays, ChevronRight, Plus, Trash2 } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { useStudy } from "@/components/providers/study-provider";
import { dateLabel, daysUntil, examTypeLabels, sizeLabels } from "@/lib/format";

export default function ExamsPage() {
  const { exams, plan, removeExam } = useStudy();
  return <>
    <PageHeading eyebrow="Prüfungen" title="Was als Nächstes zählt" description="Erfasse nur das Wesentliche. Der Plan kümmert sich um die sinnvolle Verteilung." actions={<Link href="/exams/new" className="button button-primary"><Plus size={17} />Prüfung hinzufügen</Link>} />
    <section className="exam-grid">
      {[...exams].sort((a, b) => a.date.localeCompare(b.date)).map((exam) => {
        const minutes = plan.sessions.filter((session) => session.examId === exam.id && session.type !== "break").reduce((sum, session) => sum + session.duration, 0);
        const weakest = [...exam.topics].filter((topic) => topic.confidence !== null).sort((a, b) => (a.confidence ?? 3) - (b.confidence ?? 3))[0];
        return <article className="exam-card" key={exam.id}>
          <div className="exam-card-top"><span className="exam-icon" style={{ background: `${exam.color}18`, color: exam.color }}><BookOpenCheck size={20} /></span><button className="icon-button danger-hover" aria-label={`${exam.title} löschen`} onClick={() => removeExam(exam.id)}><Trash2 size={16} /></button></div>
          <p className="eyebrow">{examTypeLabels[exam.type]} · {sizeLabels[exam.size]}</p>
          <h2>{exam.title}</h2><p className="exam-date"><CalendarDays size={16} />{dateLabel(exam.date, true)}{exam.time ? ` · ${exam.time}` : ""}</p>
          <div className="exam-countdown"><strong>{daysUntil(exam.date)}</strong><span>Tage verbleiben</span></div>
          <div className="exam-stats"><span><strong>{exam.topics.length}</strong>Themen</span><span><strong>{Math.round(minutes / 60 * 10) / 10} h</strong>geplant</span><span><strong>{weakest?.confidence ?? "–"}/5</strong>niedrigste Sicherheit</span></div>
          <div className="topic-chips">{exam.topics.slice(0, 3).map((topic) => <span key={topic.id}>{topic.name}<i>{topic.confidence ?? "?"}</i></span>)}{exam.topics.length > 3 && <span>+{exam.topics.length - 3}</span>}</div>
          <Link href={`/exams/new?edit=${exam.id}`} className="card-link">Details bearbeiten <ChevronRight size={16} /></Link>
        </article>;
      })}
      <Link href="/exams/new" className="exam-add-card"><span><Plus size={22} /></span><strong>Neue Prüfung</strong><p>In weniger als einer Minute erfasst.</p></Link>
    </section>
  </>;
}
