export function spacingScore(sessionDates: string[], candidateDate: string): number {
  if (!sessionDates.length) return 1;
  const last = sessionDates[sessionDates.length - 1];
  const elapsed = Math.max(0, Math.round((new Date(`${candidateDate}T12:00:00`).getTime() - new Date(`${last}T12:00:00`).getTime()) / 86_400_000));
  if (elapsed === 0) return 0.2;
  if (elapsed === 1) return 0.72;
  if (elapsed <= 3) return 1.25;
  return 1.05;
}

export function phaseFor(daysLeft: number, progress: number): "understand" | "practice" | "recall" | "simulation" | "review" {
  if (daysLeft <= 1) return progress > 0.72 ? "review" : "recall";
  if (daysLeft <= 3) return progress > 0.58 ? "simulation" : "practice";
  if (progress < 0.28) return "understand";
  if (progress < 0.62) return "practice";
  return daysLeft <= 5 ? "simulation" : "recall";
}
