"use client";

import { Check, Clock3, Coffee, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useStudy } from "./providers/study-provider";
import { Button } from "./ui/button";
import type { Confidence, StudySession } from "@/types/study";

const typeLabels = { understand: "Verstehen", practice: "Üben", recall: "Abrufen", simulation: "Probelauf", review: "Festigen", break: "Pause" };

export function SessionCard({ session, compact = false, featured = false }: { session: StudySession; compact?: boolean; featured?: boolean }) {
  const { exams, completeSession } = useStudy();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<"very-hard" | "hard" | "okay" | "easy" | "very-easy">("okay");
  const [confidence, setConfidence] = useState<Confidence>(null);
  const exam = exams.find((item) => item.id === session.examId);
  if (session.type === "break") return <article className="session-card break-card"><div className="session-time"><Coffee size={15} />{session.startTime}</div><div><strong>{session.title}</strong><p>{session.duration} Minuten</p></div></article>;
  const done = session.status === "completed";
  return <>
    <article className={`session-card ${done ? "session-done" : ""} ${compact ? "session-compact" : ""} ${featured ? "session-featured" : ""}`} style={{ "--subject-color": exam?.color ?? "#61705d" } as React.CSSProperties}>
      <div className="session-time"><Clock3 size={15} />{session.startTime}<span>{session.duration} min</span></div>
      <div className="session-body"><div className="session-meta"><span className="subject-dot" />{exam?.subject}<span className="tiny-badge">{typeLabels[session.type]}</span></div><h3>{session.title}</h3>{featured && <p>{session.description}</p>}</div>
      <div className="session-actions">{done ? <span className="done-label"><Check size={16} />Erledigt</span> : <Button variant={featured ? "primary" : "secondary"} onClick={() => setFeedbackOpen(true)}><Check size={16} />{featured ? "Einheit abschließen" : "Erledigt"}</Button>}</div>
    </article>
    {feedbackOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setFeedbackOpen(false)}><div className="feedback-modal" role="dialog" aria-modal="true" aria-labelledby={`feedback-${session.id}`} onMouseDown={(event) => event.stopPropagation()}><div className="modal-icon"><RotateCcw size={20} /></div><h2 id={`feedback-${session.id}`}>Wie lief die Einheit?</h2><p>Eine kurze Einschätzung reicht. Damit passt sich dein nächster Plan an.</p><label>Schwierigkeit</label><div className="choice-row">{(["very-hard", "hard", "okay", "easy", "very-easy"] as const).map((value, index) => <button key={value} className={difficulty === value ? "choice active" : "choice"} onClick={() => setDifficulty(value)}>{["Sehr schwer", "Schwer", "Okay", "Leicht", "Sehr leicht"][index]}</button>)}</div><label>Wie sicher fühlst du dich jetzt?</label><div className="confidence-row">{([1, 2, 3, 4, 5] as const).map((value) => <button key={value} className={confidence === value ? "confidence active" : "confidence"} onClick={() => setConfidence(value)}>{value}</button>)}</div><div className="modal-actions"><Button variant="ghost" onClick={() => setFeedbackOpen(false)}>Später</Button><Button onClick={() => { completeSession(session.id, { difficulty, confidence }); setFeedbackOpen(false); }}>Speichern</Button></div></div></div>}
  </>;
}
