import { createDemoData } from "./demo-data";
import type { StudyData } from "@/types/study";
import { backfillActivityLog } from "./statistics";

export function normalizeStudyData(value: StudyData | null | undefined): StudyData {
  const fallback = createDemoData();
  if (!value) return fallback;
  const plan = value.plan ?? fallback.plan;
  const feedback = value.feedback ?? [];
  const calendarItems = value.calendarItems ?? [];
  const exams = (value.exams ?? []).map((exam) => ({ ...exam, learningMethod: exam.learningMethod ?? ("auto" as const) }));
  return {
    ...fallback,
    ...value,
    preferences: { ...fallback.preferences, ...value.preferences },
    availability: value.availability ?? fallback.availability,
    exams,
    plan,
    feedback,
    calendarItems,
    learningProgress: value.learningProgress ?? {},
    todoFocusProgress: value.todoFocusProgress ?? {},
    activityLog: backfillActivityLog(value.activityLog, plan.sessions, exams, feedback, calendarItems),
  };
}
