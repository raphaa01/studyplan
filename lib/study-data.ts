import { createDemoData } from "./demo-data";
import type { StudyData } from "@/types/study";
import { backfillActivityLog } from "./statistics";
import { routineCadence } from "./routines";
import { stableSubjectId } from "./planner/subject-normalization";

export function normalizeStudyData(value: StudyData | null | undefined): StudyData {
  const fallback = createDemoData();
  if (!value) return fallback;
  const plan = value.plan ?? fallback.plan;
  const feedback = value.feedback ?? [];
  const calendarItems = value.calendarItems ?? [];
  const exams = (value.exams ?? []).map((exam) => ({ ...exam, learningMethod: exam.learningMethod ?? ("auto" as const) }));
  const routines = (value.routines ?? []).map((routine) => {
    const storedWeeklyMinutes = (routine as typeof routine & { weeklyMinutes?: number }).weeklyMinutes;
    const storedFixedSlots = (routine as typeof routine & { fixedSlots?: typeof routine.fixedSlots }).fixedSlots ?? [];
    const requestedMode = (routine as typeof routine & { schedulingMode?: "ai" | "fixed" }).schedulingMode;
    const schedulingMode = requestedMode === "fixed" && storedFixedSlots.length ? "fixed" as const : "ai" as const;
    const cadence = routineCadence(storedWeeklyMinutes ?? routine.sessionsPerWeek * routine.preferredSessionMinutes, schedulingMode === "fixed" ? storedFixedSlots.length : 0);
    return {
      ...routine,
      subjectId: stableSubjectId(routine.subjectId, routine.subject),
      weeklyMinutes: cadence.weeklyMinutes,
      schedulingMode,
      fixedSlots: storedFixedSlots,
      sessionsPerWeek: cadence.sessionsPerWeek,
      preferredSessionMinutes: cadence.preferredSessionMinutes,
      flexible: schedulingMode === "ai",
      learningMethod: routine.learningMethod ?? ("auto" as const),
      enabled: routine.enabled ?? true,
    };
  });
  return {
    ...fallback,
    ...value,
    preferences: { ...fallback.preferences, ...value.preferences },
    availability: value.availability ?? fallback.availability,
    exams,
    routines,
    plan,
    feedback,
    calendarItems,
    learningProgress: value.learningProgress ?? {},
    todoFocusProgress: value.todoFocusProgress ?? {},
    activityLog: backfillActivityLog(value.activityLog, plan.sessions, exams, feedback, calendarItems),
  };
}
