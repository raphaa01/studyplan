"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createDemoData } from "@/lib/demo-data";
import { generateStudyPlan } from "@/lib/planner";
import { LocalStorageRepository } from "@/lib/storage/local-storage-repository";
import type { AvailabilityDay, Exam, StudyData, StudySessionFeedback, UserPreferences } from "@/types/study";
import { useAccount } from "./account-provider";

interface StudyContextValue extends StudyData {
  hydrated: boolean;
  saveExam: (exam: Exam) => void;
  removeExam: (id: string) => void;
  saveAvailability: (value: AvailabilityDay[]) => void;
  savePreferences: (value: UserPreferences) => void;
  completeSession: (sessionId: string, feedback: Omit<StudySessionFeedback, "sessionId" | "completedAt">) => void;
  skipSession: (sessionId: string) => void;
  optimizePlan: () => void;
  resetDemo: () => void;
}

const StudyContext = createContext<StudyContextValue | null>(null);
export function StudyProvider({ children }: { children: React.ReactNode }) {
  const { account, hydrated: accountHydrated } = useAccount();
  const scopeId = account?.id ?? "guest";
  const repository = useMemo(() => new LocalStorageRepository(scopeId), [scopeId]);
  const [data, setData] = useState<StudyData>(() => createDemoData());
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const hydrated = accountHydrated && loadedScope === scopeId;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!accountHydrated) return;
      const stored = repository.getAll();
      const next = stored ?? createDemoData();
      setData(next);
      if (!stored) repository.saveAll(next);
      setLoadedScope(scopeId);
    });
    return () => { active = false; };
  }, [accountHydrated, repository, scopeId]);

  const commit = useCallback((updater: (current: StudyData) => StudyData) => {
    setData((current) => {
      const next = updater(current);
      repository.saveAll(next);
      return next;
    });
  }, [repository]);

  const optimize = useCallback((current: StudyData) => ({
    ...current,
    plan: generateStudyPlan({
      availability: current.availability,
      exams: current.exams,
      previousSessions: current.plan.sessions,
      feedback: current.feedback,
      preferences: current.preferences,
    }),
  }), []);

  const value = useMemo<StudyContextValue>(() => ({
    ...data,
    hydrated,
    saveExam: (exam) => commit((current) => optimize({ ...current, exams: [...current.exams.filter((item) => item.id !== exam.id), exam] })),
    removeExam: (id) => commit((current) => optimize({ ...current, exams: current.exams.filter((exam) => exam.id !== id) })),
    saveAvailability: (availability) => commit((current) => optimize({ ...current, availability })),
    savePreferences: (preferences) => commit((current) => ({ ...current, preferences })),
    completeSession: (sessionId, nextFeedback) => commit((current) => {
      const feedback: StudySessionFeedback = { sessionId, completedAt: new Date().toISOString(), ...nextFeedback };
      const sessions = current.plan.sessions.map((session) => session.id === sessionId ? { ...session, status: "completed" as const } : session);
      const topicId = sessions.find((session) => session.id === sessionId)?.topicId;
      const exams = topicId && nextFeedback.confidence
        ? current.exams.map((exam) => ({ ...exam, topics: exam.topics.map((topic) => topic.id === topicId ? { ...topic, confidence: nextFeedback.confidence } : topic) }))
        : current.exams;
      return { ...current, exams, feedback: [...current.feedback.filter((item) => item.sessionId !== sessionId), feedback], plan: { ...current.plan, sessions } };
    }),
    skipSession: (sessionId) => commit((current) => ({ ...current, plan: { ...current.plan, sessions: current.plan.sessions.map((session) => session.id === sessionId ? { ...session, status: "skipped" as const } : session) } })),
    optimizePlan: () => commit(optimize),
    resetDemo: () => commit(() => createDemoData()),
  }), [commit, data, hydrated, optimize]);

  return <StudyContext.Provider value={value}>{hydrated ? children : <div className="app-loading"><span className="brand-mark">F</span><p>Dein Plan wird vorbereitet …</p></div>}</StudyContext.Provider>;
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) throw new Error("useStudy must be used inside StudyProvider");
  return context;
}
