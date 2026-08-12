const DAY_MS = 86_400_000;

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function fromDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addDays(value: string, days: number): string {
  const date = fromDateKey(value);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function daysBetween(start: string, end: string): number {
  return Math.round((fromDateKey(end).getTime() - fromDateKey(start).getTime()) / DAY_MS);
}

export function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function timeFromMinutes(value: number): string {
  const safe = Math.max(0, Math.min(23 * 60 + 59, value));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function startOfToday(): string {
  return toDateKey(new Date());
}

export function startOfWeek(value = startOfToday()): string {
  const date = fromDateKey(value);
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDays(value, -mondayOffset);
}

export function formatGermanDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("de-DE", options ?? { weekday: "short", day: "2-digit", month: "short" }).format(fromDateKey(value));
}
