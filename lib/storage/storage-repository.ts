import type { AvailabilityDay, Exam, StudyData, StudyPlan, StudySessionFeedback, UserPreferences } from "@/types/study";

export interface StorageRepository {
  getAll(): StudyData | null;
  saveAll(data: StudyData): void;
  getUserSettings(): UserPreferences | null;
  saveUserSettings(settings: UserPreferences): void;
  getAvailability(): AvailabilityDay[];
  saveAvailability(availability: AvailabilityDay[]): void;
  getExams(): Exam[];
  saveExams(exams: Exam[]): void;
  getStudyPlan(): StudyPlan | null;
  saveStudyPlan(plan: StudyPlan): void;
  getFeedback(): StudySessionFeedback[];
  saveFeedback(feedback: StudySessionFeedback[]): void;
  clear(): void;
}
