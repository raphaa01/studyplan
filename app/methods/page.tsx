"use client";

import { ArrowUpRight, BrainCircuit, Check, FlaskConical } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { useStudy } from "@/components/providers/study-provider";
import { learningMethods, recommendLearningMethod, resolvedLearningMethod } from "@/lib/learning-methods";
import type { LearningMethodId } from "@/types/study";

export default function MethodsPage() {
  const { exams, saveExam } = useStudy();
  return <>
    <PageHeading eyebrow="Lernmethoden" title="Die richtige Methode für jede Prüfung." description="Fokusplan wählt eine passende Strategie – transparent, evidenzbasiert und jederzeit von dir änderbar." />
    <section className="method-assignment-panel"><div><span className="method-panel-icon"><BrainCircuit size={20} /></span><div><h2>Methoden je Prüfung</h2><p>„Automatisch“ bewertet Fach, Prüfungsart, Umfang, Themenzahl und deine Sicherheit.</p></div></div>
      <div className="method-assignment-list">{exams.length ? exams.map((exam) => { const recommendation = recommendLearningMethod(exam); const resolved = resolvedLearningMethod(exam); return <div className="method-assignment" key={exam.id}><i style={{ background: exam.color }} /><span><strong>{exam.title}</strong><small>{exam.learningMethod === "auto" ? `Empfohlen: ${learningMethods.find((method) => method.id === recommendation)?.name}` : "Manuell gewählt"}</small></span><select aria-label={`Lernmethode für ${exam.title}`} value={exam.learningMethod} onChange={(event) => saveExam({ ...exam, learningMethod: event.target.value as LearningMethodId })}><option value="auto">Automatisch</option>{learningMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select><span className="method-active"><Check size={13} />{learningMethods.find((method) => method.id === resolved)?.shortName}</span></div>; }) : <p className="method-empty">Lege zuerst eine Prüfung an. Danach erscheint hier die passende Empfehlung.</p>}</div>
    </section>
    <div className="methods-intro"><div><FlaskConical size={18} /><span><strong>Was „wissenschaftlich“ hier bedeutet</strong><small>Der Algorithmus nutzt robuste Lerneffekte. Pomodoro wird bewusst nur als Fokusstruktur eingeordnet.</small></span></div><p>Keine Blackbox-KI: Die Planung bleibt nachvollziehbar, deterministisch und reagiert bei jeder Änderung sofort neu.</p></div>
    <section className="method-grid">{learningMethods.map((method, index) => <article className="method-card" key={method.id}><div className="method-card-top"><span>0{index + 1}</span><em>{method.cadence}</em></div><h2>{method.name}</h2><p className="method-summary">{method.summary}</p><dl><div><dt>Besonders gut für</dt><dd>{method.bestFor}</dd></div><div><dt>Forschungsstand</dt><dd>{method.evidence}</dd></div></dl><a href={method.sourceUrl} target="_blank" rel="noreferrer">Studie ansehen <ArrowUpRight size={14} /></a></article>)}</section>
  </>;
}
