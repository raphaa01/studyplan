"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleHelp, Clock3, ListTodo } from "lucide-react";
import { createTodoFocusProgress, remainingFocusSeconds } from "@/lib/focus-timer";
import type { TodoFocusProgress } from "@/types/study";
import { FocusTimer } from "./focus-timer";
import { BambooGrove } from "./bamboo-grove";
import { useStudy } from "./providers/study-provider";
import { Button } from "./ui/button";

export function TodoFocusMode({ itemId }: { itemId: string }) {
  const router = useRouter();
  const { calendarItems, todoFocusProgress, saveTodoFocusProgress, completeCalendarItem } = useStudy();
  const item = calendarItems.find((candidate) => candidate.id === itemId && candidate.kind === "todo");
  const initialProgress = useMemo(() => item ? createTodoFocusProgress(item) : null, [item]);
  const progress = todoFocusProgress[itemId] ?? initialProgress;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!progress?.runningSince) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [progress?.runningSince]);

  if (!item || !progress) return <section className="learn-not-found"><Clock3 size={28} /><h1>To-do nicht gefunden</h1><p>Es wurde möglicherweise bereits gelöscht.</p><Link className="button button-primary" href="/plan">Zum Wochenplan</Link></section>;

  const durationSeconds = item.duration * 60;
  const remaining = remainingFocusSeconds(progress, nowMs);

  function persist(patch: Partial<TodoFocusProgress>) {
    saveTodoFocusProgress({ ...progress!, ...patch, updatedAt: new Date().toISOString() });
  }

  function toggleTimer() {
    if (progress!.runningSince) persist({ remainingSeconds: remaining, runningSince: null });
    else persist({ remainingSeconds: remaining === 0 ? durationSeconds : remaining, runningSince: new Date().toISOString() });
  }

  function resetTimer() {
    persist({ remainingSeconds: durationSeconds, runningSince: null });
  }

  function finish() {
    completeCalendarItem(itemId);
    router.push("/");
  }

  return <div className="learning-mode todo-focus-mode">
    <BambooGrove running={Boolean(progress.runningSince)} />
    <header className="learning-header todo-focus-header"><Link href="/" className="learn-back"><ArrowLeft size={16} />Fokus verlassen</Link><div className="learning-title"><i /><span><small>Persönliches To-do</small><strong>{item.title}</strong></span></div><span className="learning-sync">Fortschritt wird gespeichert</span></header>
    <main className="todo-focus-canvas">
      <section className="todo-focus-card">
        <div className="todo-focus-copy"><span className="todo-focus-kicker"><ListTodo size={14} />Jetzt nur diese Aufgabe</span><h1>{item.title}</h1><p>{item.notes || "Schließe alles Unnötige, starte den Timer und arbeite nur an diesem To-do."}</p><div className="todo-focus-meta"><span><Clock3 size={15} />Geplant: {item.duration} Minuten</span><span><CircleHelp size={15} />Du kannst jederzeit pausieren</span></div></div>
        <div className="todo-focus-timer"><FocusTimer remaining={remaining} durationSeconds={durationSeconds} running={Boolean(progress.runningSince)} accent="#9a6652" onToggle={toggleTimer} onReset={resetTimer} /></div>
      </section>
      <section className="todo-finish-card"><div><span>Fertig?</span><strong>Hake das To-do bewusst ab.</strong><p>Der Timer muss dafür nicht vollständig abgelaufen sein.</p></div><Button onClick={finish}><Check size={17} />Als erledigt markieren</Button></section>
    </main>
  </div>;
}
