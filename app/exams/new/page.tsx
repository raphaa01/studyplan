"use client";

import { FormEvent, Suspense, useId, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarPlus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/components/providers/study-provider";
import { addDays, startOfToday } from "@/lib/planner";
import { subjectColors } from "@/lib/demo-data";
import type { Confidence, Exam, ExamSize, ExamType } from "@/types/study";

function ExamForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { exams, saveExam } = useStudy();
  const formId = useId().replace(/:/g, "");
  const editing = exams.find((exam) => exam.id === params.get("edit"));
  const initial = useMemo<Exam>(() => editing ?? ({ id: `exam-${formId}`, subject: "", title: "", type: "exam", date: addDays(startOfToday(), 7), size: "medium", importance: 3, estimatedHours: null, color: subjectColors[exams.length % subjectColors.length], topics: [{ id: `topic-${formId}`, name: "", confidence: null }] }), [editing, exams.length, formId]);
  const [exam, setExam] = useState(initial);
  const [hoursMode, setHoursMode] = useState<"auto" | "custom">(initial.estimatedHours ? "custom" : "auto");
  function submit(event: FormEvent) {
    event.preventDefault();
    const topics = exam.topics.filter((topic) => topic.name.trim());
    saveExam({ ...exam, title: exam.title.trim() || `${exam.subject} ${exam.type === "test" ? "Test" : "Klausur"}`, topics: topics.length ? topics : [{ id: `topic-general-${Date.now()}`, name: "Gesamter Prüfungsstoff", confidence: null }], estimatedHours: hoursMode === "auto" ? null : exam.estimatedHours });
    router.push("/exams");
  }
  const updateTopic = (id: string, patch: Partial<Exam["topics"][number]>) => setExam((value) => ({ ...value, topics: value.topics.map((topic) => topic.id === id ? { ...topic, ...patch } : topic) }));
  const addTopic = () => setExam((value) => ({ ...value, topics: [...value.topics, { id: `topic-${Date.now()}-${value.topics.length}`, name: "", confidence: null }] }));
  return <>
    <Link className="back-link" href="/exams"><ArrowLeft size={16} />Zurück zu Prüfungen</Link>
    <PageHeading eyebrow={editing ? "Prüfung bearbeiten" : "Neue Prüfung"} title={editing ? exam.title : "Was steht an?"} description="Ein paar Eckdaten reichen. Zeiten und Wiederholungen berechnet der Planner." />
    <form className="form-layout" onSubmit={submit}>
      <div className="form-main">
        <section className="form-section"><div className="form-section-number">1</div><div className="form-section-content"><h2>Prüfungsdetails</h2><p>Worum geht es und wann findet die Prüfung statt?</p>
          <div className="form-grid two"><label>Fach<input required value={exam.subject} onChange={(event) => setExam({ ...exam, subject: event.target.value })} placeholder="z. B. Mathematik" /></label><label>Titel <span>optional</span><input value={exam.title} onChange={(event) => setExam({ ...exam, title: event.target.value })} placeholder="z. B. Analysis Klausur" /></label></div>
          <div className="form-grid three"><label>Art<select value={exam.type} onChange={(event) => setExam({ ...exam, type: event.target.value as ExamType })}><option value="exam">Klausur</option><option value="test">Test</option><option value="oral">Mündliche Prüfung</option><option value="presentation">Präsentation</option><option value="other">Sonstige</option></select></label><label>Datum<input required type="date" value={exam.date} onChange={(event) => setExam({ ...exam, date: event.target.value })} /></label><label>Uhrzeit <span>optional</span><input type="time" value={exam.time ?? ""} onChange={(event) => setExam({ ...exam, time: event.target.value || undefined })} /></label></div>
        </div></section>
        <section className="form-section"><div className="form-section-number">2</div><div className="form-section-content"><h2>Umfang & Bedeutung</h2><p>Eine grobe Einschätzung genügt.</p>
          <label>Geschätzter Umfang</label><div className="segmented">{(["small", "medium", "large", "very-large"] as ExamSize[]).map((value, index) => <button type="button" key={value} className={exam.size === value ? "active" : ""} onClick={() => setExam({ ...exam, size: value })}>{["Klein", "Mittel", "Groß", "Sehr groß"][index]}</button>)}</div>
          <label>Wie wichtig ist die Prüfung für dich? <strong>{exam.importance}/5</strong><input className="range" type="range" min="1" max="5" value={exam.importance} onChange={(event) => setExam({ ...exam, importance: Number(event.target.value) as Exam["importance"] })} /></label>
          <label>Benötigte Lernzeit</label><div className="inline-options"><label><input type="radio" checked={hoursMode === "auto"} onChange={() => setHoursMode("auto")} />Automatisch bestimmen</label><label><input type="radio" checked={hoursMode === "custom"} onChange={() => setHoursMode("custom")} />Eigene Schätzung</label>{hoursMode === "custom" && <input className="hours-input" type="number" min="0.5" step="0.5" value={exam.estimatedHours ?? 1} onChange={(event) => setExam({ ...exam, estimatedHours: Number(event.target.value) })} />}</div>
        </div></section>
        <section className="form-section"><div className="form-section-number">3</div><div className="form-section-content"><h2>Themen & Sicherheit</h2><p>Schwächere Themen bekommen automatisch mehr aktive Wiederholungen.</p>
          <div className="topic-editor"><div className="topic-header"><span>Thema</span><span>Sicherheit</span></div>{exam.topics.map((topic, index) => <div className="topic-row" key={topic.id}><input value={topic.name} autoFocus={index === 0 && !editing} onChange={(event) => updateTopic(topic.id, { name: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTopic(); } }} placeholder="z. B. Extrempunkte" /><select value={topic.confidence ?? ""} onChange={(event) => updateTopic(topic.id, { confidence: event.target.value ? Number(event.target.value) as Confidence : null })}><option value="">Weiß ich noch nicht</option><option value="1">1 · kaum</option><option value="2">2 · unsicher</option><option value="3">3 · teilweise</option><option value="4">4 · ziemlich sicher</option><option value="5">5 · beherrsche ich</option></select><button type="button" aria-label="Thema löschen" onClick={() => setExam((value) => ({ ...value, topics: value.topics.filter((item) => item.id !== topic.id) }))}><Trash2 size={16} /></button></div>)}</div>
          <button className="add-topic" type="button" onClick={addTopic}><Plus size={16} />Weiteres Thema</button>
        </div></section>
      </div>
      <aside className="form-summary"><div className="summary-icon"><CalendarPlus size={22} /></div><h2>{exam.subject || "Neue Prüfung"}</h2><p>{exam.date ? new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${exam.date}T12:00:00`)) : "Datum fehlt"}</p><dl><div><dt>Umfang</dt><dd>{({ small: "Klein", medium: "Mittel", large: "Groß", "very-large": "Sehr groß" } as const)[exam.size]}</dd></div><div><dt>Themen</dt><dd>{exam.topics.filter((topic) => topic.name).length}</dd></div><div><dt>Lernzeit</dt><dd>{hoursMode === "auto" ? "Automatisch" : `${exam.estimatedHours ?? 1} h`}</dd></div></dl><Button type="submit">{editing ? "Änderungen speichern" : "Prüfung anlegen"}</Button><p className="summary-note">Der Lernplan wird danach automatisch neu berechnet.</p></aside>
    </form>
  </>;
}

export default function NewExamPage() {
  return <Suspense fallback={<div className="form-loading">Prüfungseditor wird vorbereitet …</div>}><ExamForm /></Suspense>;
}
