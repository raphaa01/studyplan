import { fromDateKey } from "./planner/date-utils";

export function minutesLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function dateLabel(value: string, long = false): string {
  return new Intl.DateTimeFormat("de-DE", long
    ? { weekday: "long", day: "numeric", month: "long" }
    : { day: "2-digit", month: "short" }).format(fromDateKey(value));
}

export function daysUntil(value: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.max(0, Math.round((fromDateKey(value).getTime() - today.getTime()) / 86_400_000));
}

export const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export const examTypeLabels = {
  exam: "Klausur",
  test: "Test",
  oral: "Mündliche Prüfung",
  presentation: "Präsentation",
  other: "Sonstige Prüfung",
} as const;

export const sizeLabels = { small: "Klein", medium: "Mittel", large: "Groß", "very-large": "Sehr groß" } as const;
