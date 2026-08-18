import type { LearningRoutine } from "@/types/study";

export function normalizeWeeklyMinutes(value: number): number {
  return Math.min(420, Math.max(25, Math.round(value / 5) * 5));
}

export function routineSessionDurations(weeklyMinutes: number, requestedCount: number): number[] {
  const minutes = normalizeWeeklyMinutes(weeklyMinutes);
  const count = Math.min(7, Math.max(1, Math.min(Math.floor(minutes / 25), Math.round(requestedCount) || 1)));
  const fiveMinuteUnits = minutes / 5;
  const baseUnits = Math.floor(fiveMinuteUnits / count);
  const remainder = fiveMinuteUnits % count;
  return Array.from({ length: count }, (_, index) => (baseUnits + (index < remainder ? 1 : 0)) * 5);
}

export function routineCadence(weeklyMinutes: number, fixedSlotCount = 0) {
  const minutes = normalizeWeeklyMinutes(weeklyMinutes);
  const sessionsPerWeek = Math.min(7, Math.max(1, fixedSlotCount || Math.ceil(minutes / 60))) as LearningRoutine["sessionsPerWeek"];
  const durations = routineSessionDurations(minutes, sessionsPerWeek);
  return {
    weeklyMinutes: minutes,
    sessionsPerWeek,
    preferredSessionMinutes: Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length),
    durations,
  };
}
