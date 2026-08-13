"use client";

import { Pause, Play, RotateCcw, TimerReset } from "lucide-react";
import { useId } from "react";
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
    <div className="focus-visuals">
      <div className="learning-timer" style={{ "--timer-progress": `${elapsedPercent}%`, "--subject-color": accent } as React.CSSProperties}>
        <div><span>{remaining === 0 ? "Zeit ist um" : running ? "Fokus läuft" : "Bereit"}</span><strong>{formatFocusTime(remaining)}</strong><small>von {Math.round(safeDuration / 60)} Minuten</small></div>
      </div>
      <BambooProgress progress={elapsedPercent} running={running} />
    </div>
    <div className="timer-actions">
      <Button onClick={onToggle}>{running ? <><Pause size={16} />Pausieren</> : remaining === 0 ? <><RotateCcw size={16} />Noch einmal</> : <><Play size={16} />{fresh ? "Fokus starten" : "Fortsetzen"}</>}</Button>
      <button type="button" aria-label="Timer zurücksetzen" onClick={onReset}><TimerReset size={17} /></button>
    </div>
  </div>;
}

function BambooProgress({ progress, running }: { progress: number; running: boolean }) {
  const clipId = `bamboo-${useId().replaceAll(":", "")}`;
  const roundedProgress = Math.round(progress);
  const revealHeight = 194 * progress / 100;
  const revealY = 202 - revealHeight;
  const caption = progress >= 100 ? "Gewachsen" : progress >= 66 ? "Fast geschafft" : progress >= 25 ? "Wächst mit dir" : "Dein Fokus";

  return <div className={`bamboo-progress ${running ? "is-running" : ""}`} role="progressbar" aria-label={`Bambus-Fokusfortschritt: ${roundedProgress} Prozent`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={roundedProgress}>
    <div className="bamboo-stage" aria-hidden="true">
      <BambooPlant className="bamboo-ghost" />
      <div className="bamboo-progress-fill">
        <svg className="bamboo-plant bamboo-grown" viewBox="0 0 72 210" focusable="false">
          <defs><clipPath id={clipId}><rect x="0" y={revealY} width="72" height={revealHeight} /></clipPath></defs>
          <g clipPath={`url(#${clipId})`}><BambooShapes /></g>
        </svg>
      </div>
    </div>
    <span>{caption}</span>
  </div>;
}

function BambooPlant({ className }: { className: string }) {
  return <svg className={`bamboo-plant ${className}`} viewBox="0 0 72 210" focusable="false" aria-hidden="true"><BambooShapes /></svg>;
}

function BambooShapes() {
  return <>
    <path className="bamboo-ground" d="M10 200c13-5 39-5 52 0" />
    <path className="bamboo-stem" d="M36 196V29" />
    <path className="bamboo-node" d="M30 169h12M30 137h12M30 104h12M30 71h12M31 39h10" />
    <path className="bamboo-branch" d="M36 157c-8-8-13-16-16-26M36 126c9-8 14-17 17-27M36 94c-8-8-13-17-15-27M36 62c8-7 12-14 14-23" />
    <path className="bamboo-leaf" d="M20 132c-9-1-14-7-15-16 9 1 14 6 15 16ZM22 139c-7 4-13 3-18-3 7-4 13-3 18 3ZM52 100c8-3 15-1 19 6-8 3-14 1-19-6ZM48 111c7 2 11 7 11 14-7-2-11-7-11-14ZM21 67C12 65 8 59 8 50c9 2 13 8 13 17ZM23 77c-8 3-14 1-18-6 8-3 14-1 18 6ZM50 40c7-4 14-3 19 3-7 4-14 3-19-3ZM47 49c7 1 12 5 14 12-8-1-12-5-14-12ZM36 30c-4-7-3-14 3-20 4 7 3 14-3 20Z" />
  </>;
}
