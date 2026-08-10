"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createDemoData } from "@/lib/demo-data";
import { generateStudyPlan } from "@/lib/planner";
import { LocalStorageRepository } from "@/lib/storage/local-storage-repository";
import { SupabaseStudyRepository } from "@/lib/storage/supabase-study-repository";
import type { AvailabilityDay, Exam, StudyData, StudySessionFeedback, UserPreferences } from "@/types/study";
import { useAccount } from "./account-provider";

type SyncStatus = "idle" | "syncing" | "synced" | "error";

interface StudyContextValue extends StudyData {
  hydrated: boolean;
  syncStatus: SyncStatus;
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
  const scopeId = account?.id ?? "signed-out";
  const localRepository = useMemo(() => new LocalStorageRepository(scopeId), [scopeId]);
  const cloudRepository = useMemo(() => account ? new SupabaseStudyRepository(account.id) : null, [account]);
  const [data, setData] = useState<StudyData>(() => createDemoData());
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const saveQueue = useRef(Promise.resolve());
  const hydrated = accountHydrated && loadedScope === scopeId;

  useEffect(() => {
    let active = true;
    if (!accountHydrated) return;
    queueMicrotask(() => {
      if (!active) return;
      if (!account || !cloudRepository) {
        setLoadedScope(scopeId);
        setSyncStatus("idle");
        return;
      }

      setSyncStatus("syncing");
      cloudRepository.getAll().then(async (stored) => {
        if (!active) return;
        const migration = localRepository.getAll() ?? LocalStorageRepository.findMigrationCandidate();
        const next = stored ?? migration ?? createDemoData();
        const initialized = stored
          ? next
          : { ...next, preferences: { ...next.preferences, name: account.name, onboardingCompleted: false } };

        localRepository.saveAll(initialized);
        if (!stored) await cloudRepository.saveAll(initialized);
        if (!active) return;
        setData(initialized);
        setSyncStatus("synced");
        setLoadedScope(scopeId);
      }).catch(() => {
        if (!active) return;
        setData(localRepository.getAll() ?? createDemoData());
        setSyncStatus("error");
        setLoadedScope(scopeId);
      });
    });

    return () => { active = false; };
  }, [account, accountHydrated, cloudRepository, localRepository, scopeId]);

  const commit = useCallback((updater: (current: StudyData) => StudyData) => {
    setData((current) => {
      const next = updater(current);
      localRepository.saveAll(next);
      if (cloudRepository) {
        setSyncStatus("syncing");
        saveQueue.current = saveQueue.current
          .then(() => cloudRepository.saveAll(next))
          .then(() => setSyncStatus("synced"))
          .catch(() => setSyncStatus("error"));
      }
      return next;
    });
  }, [cloudRepository, localRepository]);

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
    syncStatus,
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
  }), [commit, data, hydrated, optimize, syncStatus]);

  return <StudyContext.Provider value={value}>{hydrated ? children : <div className="app-loading"><span className="brand-mark">F</span><p>Dein Plan wird vorbereitet …</p></div>}</StudyContext.Provider>;
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) throw new Error("useStudy must be used inside StudyProvider");
  return context;
}
