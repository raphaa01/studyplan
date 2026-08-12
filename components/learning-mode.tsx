"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { useStudy } from "./providers/study-provider";
import { Button } from "./ui/button";
import { createLearningProgress, createLearningSessionContent, remainingLearningSeconds } from "@/lib/learning-session";
import { learningMethods, resolvedLearningMethod } from "@/lib/learning-methods";
import type { Confidence, LearningSessionProgress } from "@/types/study";

const stageLabels = ["Aufgaben", "Active Recall", "Lernkarten", "Abschluss"];

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function LearningMode({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { plan, exams, learningProgress, saveLearningProgress, completeSession } = useStudy();
  const session = plan.sessions.find((item) => item.id === sessionId && item.type !== "break");
  const exam = exams.find((item) => item.id === session?.examId);
  const topic = exam?.topics.find((item) => item.id === session?.topicId);
  const initialProgress = useMemo(() => session ? createLearningProgress(session) : null, [session]);
  const progress = learningProgress[sessionId] ?? initialProgress;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [difficulty, setDifficulty] = useState<"very-hard" | "hard" | "okay" | "easy" | "very-easy">("okay");
  const [confidence, setConfidence] = useState<Confidence>(null);
  const [reflection, setReflection] = useState(() => progress?.reflection ?? "");

  useEffect(() => {
    if (!progress?.runningSince) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [progress?.runningSince]);

  if (!session || !exam || !topic || !progress) return <section className="learn-not-found"><Clock3 size={28} /><h1>Lernblock nicht gefunden</h1><p>Der Plan wurde möglicherweise neu berechnet.</p><Link className="button button-primary" href="/plan">Zum Wochenplan</Link></section>;

  const content = createLearningSessionContent(session, exam, topic);
  const remaining = remainingLearningSeconds(progress, nowMs);
  const durationSeconds = session.duration * 60;
  const elapsedPercent = Math.min(100, Math.max(0, (1 - remaining / durationSeconds) * 100));
  const method = learningMethods.find((item) => item.id === resolvedLearningMethod(exam));

  function persist(patch: Partial<LearningSessionProgress>) {
    saveLearningProgress({ ...progress!, ...patch, updatedAt: new Date().toISOString() });
  }

  function toggleTimer() {
    if (progress!.runningSince) {
      persist({ remainingSeconds: remaining, runningSince: null });
    } else if (remaining === 0) {
      persist({ remainingSeconds: durationSeconds, runningSince: new Date().toISOString() });
    } else {
      persist({ remainingSeconds: remaining, runningSince: new Date().toISOString() });
    }
  }

  function resetTimer() {
    persist({ remainingSeconds: durationSeconds, runningSince: null });
  }

  function changeStage(stage: 0 | 1 | 2 | 3) {
    persist({ stage });
  }

  function finish() {
    if (reflection.trim() !== progress!.reflection) persist({ reflection: reflection.trim() });
    completeSession(sessionId, { difficulty, confidence });
    router.push("/");
  }

  return <div className="learning-mode">
    <header className="learning-header"><Link href="/" className="learn-back"><ArrowLeft size={16} />Einheit verlassen</Link><div className="learning-title"><i style={{ background: exam.color }} /><span><small>{exam.subject} · {method?.name}</small><strong>{session.title}</strong></span></div><span className="learning-sync">Fortschritt wird gespeichert</span></header>
    <nav className="learning-steps" aria-label="Lernphasen">{stageLabels.map((label, index) => <button key={label} className={`${progress.stage === index ? "active" : ""} ${progress.stage > index ? "complete" : ""}`} onClick={() => changeStage(index as 0 | 1 | 2 | 3)}><span>{progress.stage > index ? <Check size={13} /> : index + 1}</span>{label}</button>)}</nav>

    <div className="learning-layout">
      <aside className="timer-panel"><div className="learning-timer" style={{ "--timer-progress": `${elapsedPercent}%`, "--subject-color": exam.color } as React.CSSProperties}><div><span>{remaining === 0 ? "Zeit ist um" : progress.runningSince ? "Fokus läuft" : "Bereit"}</span><strong>{formatTimer(remaining)}</strong><small>von {session.duration} Minuten</small></div></div><div className="timer-actions"><Button onClick={toggleTimer}>{progress.runningSince ? <><Pause size={16} />Pausieren</> : remaining === 0 ? <><RotateCcw size={16} />Noch einmal</> : <><Play size={16} />{remaining < durationSeconds ? "Fortsetzen" : "Fokus starten"}</>}</Button><button aria-label="Timer zurücksetzen" onClick={resetTimer}><TimerReset size={17} /></button></div><div className="session-brief"><span>Ziel dieser Einheit</span><p>{session.description}</p></div><div className="quiet-tip"><CircleHelp size={15} /><p>Versuche zuerst selbst zu antworten. Das Gefühl von Anstrengung ist beim aktiven Abruf normal.</p></div></aside>

      <main className="learning-workspace">
        {progress.stage === 0 && <section className="learning-stage"><p className="eyebrow">Konkreter Ablauf</p><h1>Arbeite Schritt für Schritt.</h1><p className="learning-lead">Nicht alles gleichzeitig. Hake jeden Schritt ab, sobald er wirklich erledigt ist.</p><div className="task-checklist">{content.tasks.map((task, index) => { const checked = progress.checkedTaskIds.includes(task.id); return <button key={task.id} className={checked ? "checked" : ""} onClick={() => persist({ checkedTaskIds: checked ? progress.checkedTaskIds.filter((id) => id !== task.id) : [...progress.checkedTaskIds, task.id] })}><span>{checked ? <Check size={16} /> : index + 1}</span><p>{task.text}</p></button>; })}</div><StageNext onClick={() => changeStage(1)} label="Weiter zu Active Recall" /></section>}

        {progress.stage === 1 && <section className="learning-stage"><p className="eyebrow">Ohne Unterlagen</p><h1>Hole das Wissen aktiv zurück.</h1><p className="learning-lead">Antworte laut oder schriftlich. Öffne den Denkanstoß erst, wenn du eine eigene Antwort versucht hast.</p><div className="recall-list">{content.recall.map((item, index) => { const revealed = progress.revealedRecallIds.includes(item.id); return <article key={item.id}><span>Frage {index + 1}</span><h2>{item.prompt}</h2>{revealed ? <div className="recall-cue"><strong>Selbstcheck</strong><p>{item.cue}</p></div> : <button onClick={() => persist({ revealedRecallIds: [...progress.revealedRecallIds, item.id] })}>Denkanstoß anzeigen</button>}</article>; })}</div><StageNext onClick={() => changeStage(2)} label="Weiter zu den Lernkarten" /></section>}

        {progress.stage === 2 && <section className="learning-stage"><p className="eyebrow">Schneller Abruf</p><h1>Drei Karten zum Festigen.</h1><p className="learning-lead">Formuliere deine Antwort zuerst im Kopf und drehe die Karte erst danach um.</p><button className={`learning-flashcard ${cardFlipped ? "flipped" : ""}`} onClick={() => setCardFlipped((value) => !value)}><span>{cardFlipped ? "Rückseite" : "Vorderseite"}</span><strong>{cardFlipped ? content.cards[cardIndex].back : content.cards[cardIndex].front}</strong><small>Zum Umdrehen klicken</small></button><div className="card-navigation"><button disabled={cardIndex === 0} onClick={() => { setCardIndex((value) => value - 1); setCardFlipped(false); }}><ChevronLeft size={17} />Zurück</button><span>{cardIndex + 1} / {content.cards.length}</span><button disabled={cardIndex === content.cards.length - 1} onClick={() => { setCardIndex((value) => value + 1); setCardFlipped(false); }}>Weiter<ChevronRight size={17} /></button></div><StageNext onClick={() => changeStage(3)} label="Einheit auswerten" /></section>}

        {progress.stage === 3 && <section className="learning-stage finish-stage"><p className="eyebrow">Kurzer Check-out</p><h1>Was bleibt hängen?</h1><p className="learning-lead">Deine Einschätzung beeinflusst, wie häufig das Thema künftig eingeplant wird.</p><label>Wie lief die Einheit?</label><div className="finish-choice-row">{(["very-hard", "hard", "okay", "easy", "very-easy"] as const).map((value, index) => <button key={value} className={difficulty === value ? "active" : ""} onClick={() => setDifficulty(value)}>{["Sehr schwer", "Schwer", "Okay", "Leicht", "Sehr leicht"][index]}</button>)}</div><label>Wie sicher fühlst du dich jetzt?</label><div className="finish-confidence">{([1, 2, 3, 4, 5] as const).map((value) => <button key={value} className={confidence === value ? "active" : ""} onClick={() => setConfidence(value)}>{value}</button>)}</div><label>Eine Erkenntnis für später <span>optional</span><textarea value={reflection} onChange={(event) => setReflection(event.target.value)} onBlur={() => persist({ reflection: reflection.trim() })} placeholder="Was möchtest du beim nächsten Mal sofort wissen?" /></label><Button className="finish-button" onClick={finish}><Check size={17} />Einheit abschließen</Button></section>}
      </main>
    </div>
  </div>;
}

function StageNext({ onClick, label }: { onClick: () => void; label: string }) {
  return <div className="stage-next"><Button onClick={onClick}>{label}<ArrowRight size={16} /></Button></div>;
}
