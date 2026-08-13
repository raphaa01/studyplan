"use client";

import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { formatFocusTime } from "@/lib/focus-timer";
import { Button } from "./ui/button";

interface FocusTimerProps {
  remaining: number;
  durationSeconds: number;
  running: boolean;
  accent: string;
  onToggle: () => void;
  onReset: () => void;
}

export function FocusTimer({ remaining, durationSeconds, running, accent, onToggle, onReset }: FocusTimerProps) {
  const safeDuration = Math.max(1, durationSeconds);
  const elapsedPercent = Math.min(100, Math.max(0, (1 - remaining / safeDuration) * 100));
  const fresh = remaining === durationSeconds;

  return <div className="focus-timer-control">
    <div className="learning-timer" style={{ "--timer-progress": `${elapsedPercent}%`, "--subject-color": accent } as React.CSSProperties}>
      <div><span>{remaining === 0 ? "Zeit ist um" : running ? "Fokus läuft" : "Bereit"}</span><strong>{formatFocusTime(remaining)}</strong><small>von {Math.round(safeDuration / 60)} Minuten</small></div>
    </div>
    <div className="timer-actions">
      <Button onClick={onToggle}>{running ? <><Pause size={16} />Pausieren</> : remaining === 0 ? <><RotateCcw size={16} />Noch einmal</> : <><Play size={16} />{fresh ? "Fokus starten" : "Fortsetzen"}</>}</Button>
      <button type="button" aria-label="Timer zurücksetzen" onClick={onReset}><TimerReset size={17} /></button>
    </div>
  </div>;
}
