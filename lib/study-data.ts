import { createDemoData } from "./demo-data";
import type { StudyData } from "@/types/study";

export function normalizeStudyData(value: StudyData | null | undefined): StudyData {
  const fallback = createDemoData();
  if (!value) return fallback;
  return {
    ...fallback,
    ...value,
    preferences: { ...fallback.preferences, ...value.preferences },
    availability: value.availability ?? fallback.availability,
    exams: (value.exams ?? []).map((exam) => ({ ...exam, learningMethod: exam.learningMethod ?? "auto" })),
    plan: value.plan ?? fallback.plan,
    feedback: value.feedback ?? [],
    calendarItems: value.calendarItems ?? [],
    learningProgress: value.learningProgress ?? {},
  };
}
