import type { AvailabilityDay, Exam, StudyData, StudyPlan, StudySessionFeedback, UserPreferences } from "@/types/study";
import type { StorageRepository } from "./storage-repository";

const LEGACY_KEY = "fokusplan:data:v1";

export class LocalStorageRepository implements StorageRepository {
  private readonly key: string;

  constructor(accountId = "guest") {
    this.key = `${LEGACY_KEY}:${accountId}`;
  }

  static migrateLegacyTo(accountId: string): void {
    if (typeof window === "undefined") return;
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    const target = `${LEGACY_KEY}:${accountId}`;
    if (legacy && !window.localStorage.getItem(target)) window.localStorage.setItem(target, legacy);
  }

  static findMigrationCandidate(): StudyData | null {
    if (typeof window === "undefined") return null;
    const direct = window.localStorage.getItem(LEGACY_KEY);
    const scopedKey = Object.keys(window.localStorage).find((key) => key.startsWith(`${LEGACY_KEY}:`) && !key.endsWith(":guest"));
    const raw = direct ?? (scopedKey ? window.localStorage.getItem(scopedKey) : null);
    if (!raw) return null;
    try { return JSON.parse(raw) as StudyData; } catch { return null; }
  }

  private read(): StudyData | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) as StudyData : null;
    } catch {
      return null;
    }
  }

  private mutate(mutator: (current: StudyData) => StudyData): void {
    const current = this.read();
    if (!current) return;
    this.saveAll(mutator(current));
  }

  getAll() { return this.read(); }
  saveAll(data: StudyData) { if (typeof window !== "undefined") window.localStorage.setItem(this.key, JSON.stringify(data)); }
  getUserSettings() { return this.read()?.preferences ?? null; }
  saveUserSettings(preferences: UserPreferences) { this.mutate((data) => ({ ...data, preferences })); }
  getAvailability() { return this.read()?.availability ?? []; }
  saveAvailability(availability: AvailabilityDay[]) { this.mutate((data) => ({ ...data, availability })); }
  getExams() { return this.read()?.exams ?? []; }
  saveExams(exams: Exam[]) { this.mutate((data) => ({ ...data, exams })); }
  getStudyPlan() { return this.read()?.plan ?? null; }
  saveStudyPlan(plan: StudyPlan) { this.mutate((data) => ({ ...data, plan })); }
  getFeedback() { return this.read()?.feedback ?? []; }
  saveFeedback(feedback: StudySessionFeedback[]) { this.mutate((data) => ({ ...data, feedback })); }
  clear() { if (typeof window !== "undefined") window.localStorage.removeItem(this.key); }
}
