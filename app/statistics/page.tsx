"use client";

import { useMemo, useState } from "react";
import { BookOpenCheck, ChartNoAxesCombined, CheckCircle2, Clock3, History, ListTodo } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { useStudy } from "@/components/providers/study-provider";
import { minutesLabel } from "@/lib/format";
import { activityDateLabel, buildStatistics, type StatisticsRange } from "@/lib/statistics";
import type { ActivityRecord } from "@/types/study";

const rangeLabels: Record<StatisticsRange, string> = {
  "12-weeks": "12 Wochen",
  "6-months": "6 Monate",
  all: "Gesamt",
};

const subjectColors = ["#47624b", "#68759a", "#a16f57", "#80668f", "#7b824c", "#47777a"];

export default function StatisticsPage() {
  const { activityLog } = useStudy();
  return <StatisticsView activityLog={activityLog} />;
}

export function StatisticsView({ activityLog }: { activityLog: ActivityRecord[] }) {
  const [range, setRange] = useState<StatisticsRange>("12-weeks");
  const [now] = useState(() => new Date());
  const statistics = useMemo(() => buildStatistics(activityLog, range, now), [activityLog, now, range]);
  const maxMinutes = Math.max(1, ...statistics.timeline.map((point) => point.studyMinutes));

  return <div className="statistics-page">
    <PageHeading eyebrow="Dein Fortschritt" title="Was du geschafft hast, bleibt sichtbar." description="Lernzeit, abgeschlossene Einheiten und erledigte To-dos werden automatisch mit deinem Konto gespeichert." />

    <section className="statistics-metrics" aria-label="Gesamtstatistik">
      <article className="statistics-metric primary"><span><Clock3 size={18} />Gesamte Lernzeit</span><strong>{minutesLabel(statistics.totalStudyMinutes)}</strong><small>{statistics.activeDays} {statistics.activeDays === 1 ? "aktiver Tag" : "aktive Tage"}</small></article>
      <article className="statistics-metric"><span><BookOpenCheck size={18} />Lerneinheiten</span><strong>{statistics.completedStudySessions}</strong><small>{statistics.averageSessionMinutes ? `Ø ${statistics.averageSessionMinutes} Minuten pro Einheit` : "Noch keine Einheit abgeschlossen"}</small></article>
      <article className="statistics-metric"><span><ListTodo size={18} />Erledigte To-dos</span><strong>{statistics.completedTodos}</strong><small>dauerhaft im Verlauf gespeichert</small></article>
    </section>

    <section className="statistics-panel statistics-trend-panel">
      <div className="statistics-panel-head"><div><p className="eyebrow">Verlauf</p><h2>Deine Lernroutine</h2><p>{minutesLabel(statistics.timelineStudyMinutes)} · {statistics.timelineStudySessions} Einheiten · {statistics.timelineTodos} To-dos im gewählten Zeitraum</p></div><div className="statistics-range" aria-label="Zeitraum auswählen">{(Object.keys(rangeLabels) as StatisticsRange[]).map((value) => <button type="button" key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>{rangeLabels[value]}</button>)}</div></div>
      <div className="statistics-chart-scroll">
        <div className="statistics-chart" style={{ "--chart-columns": statistics.timeline.length } as React.CSSProperties}>
          {statistics.timeline.map((point) => {
            const height = point.studyMinutes ? Math.max(5, point.studyMinutes / maxMinutes * 100) : 0;
            return <div className="statistics-column" key={point.key} aria-label={`${point.fullLabel}: ${minutesLabel(point.studyMinutes)}, ${point.studyCount} ${point.studyCount === 1 ? "Lerneinheit" : "Lerneinheiten"}, ${point.todoCount} ${point.todoCount === 1 ? "To-do" : "To-dos"}`}>
              <div className="statistics-column-value">{point.studyMinutes ? minutesLabel(point.studyMinutes) : ""}</div>
              <div className="statistics-bar-track"><span style={{ height: `${height}%` }} /></div>
              <span className="statistics-column-label">{point.label}</span>
              <span className={`statistics-todo-mark ${point.todoCount ? "visible" : ""}`}>{point.todoCount ? `${point.todoCount} Todo${point.todoCount === 1 ? "" : "s"}` : ""}</span>
            </div>;
          })}
          {!statistics.timelineStudySessions && !statistics.timelineTodos && <div className="statistics-chart-empty"><ChartNoAxesCombined size={23} /><strong>Dein Verlauf beginnt mit dem ersten Abschluss.</strong><span>Starte eine Lerneinheit oder hake ein To-do ab.</span></div>}
        </div>
      </div>
      <div className="statistics-legend"><span><i />Lernzeit</span><span><i />Abgeschlossene To-dos</span></div>
    </section>

    <div className="statistics-detail-grid">
      <section className="statistics-panel">
        <div className="statistics-panel-head compact"><div><p className="eyebrow">Verteilung</p><h2>Lernzeit nach Fach</h2></div></div>
        {statistics.subjects.length ? <div className="statistics-subjects">{statistics.subjects.map((subject, index) => <div className="statistics-subject" key={subject.subject}><div><span><i style={{ background: subjectColors[index % subjectColors.length] }} />{subject.subject}</span><strong>{minutesLabel(subject.minutes)}</strong></div><div className="statistics-subject-track"><span style={{ width: `${subject.share}%`, background: subjectColors[index % subjectColors.length] }} /></div><small>{subject.sessions} {subject.sessions === 1 ? "Einheit" : "Einheiten"} · {Math.round(subject.share)}%</small></div>)}</div> : <div className="statistics-detail-empty"><BookOpenCheck size={22} /><p>Nach deiner ersten abgeschlossenen Lerneinheit siehst du hier, wie sich deine Zeit auf die Fächer verteilt.</p></div>}
      </section>

      <section className="statistics-panel">
        <div className="statistics-panel-head compact"><div><p className="eyebrow">Zuletzt geschafft</p><h2>Aktivitätsverlauf</h2></div><History size={18} /></div>
        {statistics.recent.length ? <div className="statistics-history">{statistics.recent.map((record) => <article key={record.id}><span className={`statistics-history-icon ${record.kind}`}>{record.kind === "study" ? <BookOpenCheck size={15} /> : <CheckCircle2 size={15} />}</span><div><small>{record.kind === "study" ? record.subject : "To-do"}</small><strong>{record.title}</strong><span>{activityDateLabel(record.completedAt)}{record.kind === "study" ? ` · ${minutesLabel(record.durationMinutes)}` : ""}</span></div></article>)}</div> : <div className="statistics-detail-empty"><History size={22} /><p>Hier erscheinen deine letzten abgeschlossenen Lerneinheiten und To-dos.</p></div>}
      </section>
    </div>
  </div>;
}
