"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createDemoData } from "@/lib/demo-data";
import { generateAIStudyPlan, generateStudyPlan } from "@/lib/planner";
import { LocalStorageRepository } from "@/lib/storage/local-storage-repository";
import { SupabaseStudyRepository } from "@/lib/storage/supabase-study-repository";
import { normalizeStudyData } from "@/lib/study-data";
import { appendActivityRecord, createStudyActivity, createTodoActivity } from "@/lib/statistics";
import type { AvailabilityDay, CalendarItem, Exam, LearningRoutine, LearningSessionProgress, PlannerInput, StudyData, StudySessionFeedback, TodoFocusProgress, UserPreferences } from "@/types/study";
import { useAccount } from "./account-provider";

type SyncStatus = "idle" | "syncing" | "synced" | "error";
type PlannerStatus = "idle" | "loading" | "ready" | "fallback";

interface StudyContextValue extends StudyData {
  hydrated: boolean;
  syncStatus: SyncStatus;
  plannerStatus: PlannerStatus;
  plannerReason: string | null;
  saveExam: (exam: Exam) => void;
  removeExam: (id: string) => void;
  saveAvailability: (value: AvailabilityDay[]) => void;
  saveLearningSettings: (availability: AvailabilityDay[], routines: LearningRoutine[]) => void;
  savePreferences: (value: UserPreferences) => void;
  saveCalendarItem: (value: CalendarItem) => void;
  removeCalendarItem: (id: string) => void;
  completeCalendarItem: (id: string) => void;
  saveLearningProgress: (value: LearningSessionProgress) => void;
  clearLearningProgress: (sessionId: string) => void;
  saveTodoFocusProgress: (value: TodoFocusProgress) => void;
  clearTodoFocusProgress: (itemId: string) => void;
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
  const [plannerStatus, setPlannerStatus] = useState<PlannerStatus>("idle");
  const [plannerReason, setPlannerReason] = useState<string | null>(null);
  const [plannerRevision, setPlannerRevision] = useState(0);
  const saveQueue = useRef(Promise.resolve());
  const plannerRequest = useRef(0);
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
        const next = normalizeStudyData(stored ?? migration ?? createDemoData());
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
        setData(normalizeStudyData(localRepository.getAll() ?? createDemoData()));
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
      routines: current.routines,
      previousSessions: current.plan.sessions,
      feedback: current.feedback,
      preferences: current.preferences,
      calendarItems: current.calendarItems,
    }),
  }), []);

  const plannerInput = useMemo<PlannerInput>(() => ({
    availability: data.availability,
    exams: data.exams,
    routines: data.routines,
    previousSessions: data.plan.sessions.filter((session) => session.status === "completed" || session.status === "skipped"),
    feedback: data.feedback,
    preferences: data.preferences,
    calendarItems: data.calendarItems,
  }), [data.availability, data.calendarItems, data.exams, data.feedback, data.plan.sessions, data.preferences, data.routines]);
  const plannerInputKey = JSON.stringify(plannerInput);

  useEffect(() => {
    if (!hydrated || !account) return;
    const request = ++plannerRequest.current;
    queueMicrotask(() => {
      if (plannerRequest.current !== request) return;
      setPlannerStatus("loading");
      setPlannerReason(null);
      void generateAIStudyPlan(plannerInput).then((result) => {
        if (plannerRequest.current !== request) return;
        setPlannerStatus(result.status);
        setPlannerReason(result.reason ?? null);
        setData((current) => {
          const next = { ...current, plan: result.plan };
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
      });
    });
  // plannerInputKey is the serialized, immutable snapshot used for this inference request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, cloudRepository, hydrated, localRepository, plannerInputKey, plannerRevision]);

  const value = useMemo<StudyContextValue>(() => ({
    ...data,
    hydrated,
    syncStatus,
    plannerStatus,
    plannerReason,
    saveExam: (exam) => commit((current) => optimize({ ...current, exams: [...current.exams.filter((item) => item.id !== exam.id), exam] })),
    removeExam: (id) => commit((current) => optimize({ ...current, exams: current.exams.filter((exam) => exam.id !== id) })),
    saveAvailability: (availability) => commit((current) => optimize({ ...current, availability })),
    saveLearningSettings: (availability, routines) => commit((current) => optimize({ ...current, availability, routines })),
    savePreferences: (preferences) => commit((current) => ({ ...current, preferences })),
    saveCalendarItem: (calendarItem) => commit((current) => optimize({ ...current, calendarItems: [...current.calendarItems.filter((item) => item.id !== calendarItem.id), calendarItem] })),
    removeCalendarItem: (id) => commit((current) => {
      const todoFocusProgress = { ...current.todoFocusProgress };
      delete todoFocusProgress[id];
      return optimize({ ...current, todoFocusProgress, calendarItems: current.calendarItems.filter((item) => item.id !== id) });
    }),
    completeCalendarItem: (id) => commit((current) => {
      const calendarItem = current.calendarItems.find((item) => item.id === id);
      const completedAt = new Date().toISOString();
      const todoFocusProgress = { ...current.todoFocusProgress };
      delete todoFocusProgress[id];
      const activityLog = calendarItem?.kind === "todo" && calendarItem.status !== "completed"
        ? appendActivityRecord(current.activityLog, createTodoActivity(calendarItem, completedAt))
        : current.activityLog;
      return { ...current, activityLog, todoFocusProgress, calendarItems: current.calendarItems.map((item) => item.id === id ? { ...item, status: "completed" as const, completedAt } : item) };
    }),
    saveLearningProgress: (progress) => commit((current) => ({ ...current, learningProgress: { ...current.learningProgress, [progress.sessionId]: progress } })),
    clearLearningProgress: (sessionId) => commit((current) => {
      const learningProgress = { ...current.learningProgress };
      delete learningProgress[sessionId];
      return { ...current, learningProgress };
    }),
    saveTodoFocusProgress: (progress) => commit((current) => ({ ...current, todoFocusProgress: { ...current.todoFocusProgress, [progress.itemId]: progress } })),
    clearTodoFocusProgress: (itemId) => commit((current) => {
      const todoFocusProgress = { ...current.todoFocusProgress };
      delete todoFocusProgress[itemId];
      return { ...current, todoFocusProgress };
    }),
    completeSession: (sessionId, nextFeedback) => commit((current) => {
      const completedAt = new Date().toISOString();
      const completedSession = current.plan.sessions.find((session) => session.id === sessionId);
      const feedback: StudySessionFeedback = { sessionId, completedAt, ...nextFeedback };
      const sessions = current.plan.sessions.map((session) => session.id === sessionId ? { ...session, status: "completed" as const } : session);
      const topicId = sessions.find((session) => session.id === sessionId)?.topicId;
      const exams = topicId && nextFeedback.confidence
        ? current.exams.map((exam) => ({ ...exam, topics: exam.topics.map((topic) => topic.id === topicId ? { ...topic, confidence: nextFeedback.confidence } : topic) }))
        : current.exams;
      const learningProgress = { ...current.learningProgress };
      delete learningProgress[sessionId];
      const exam = current.exams.find((item) => item.id === completedSession?.examId);
      const activityLog = completedSession && completedSession.type !== "break" && completedSession.status !== "completed"
        ? appendActivityRecord(current.activityLog, createStudyActivity(completedSession, exam, completedAt))
        : current.activityLog;
      return { ...current, activityLog, exams, learningProgress, feedback: [...current.feedback.filter((item) => item.sessionId !== sessionId), feedback], plan: { ...current.plan, sessions } };
    }),
    skipSession: (sessionId) => commit((current) => ({ ...current, plan: { ...current.plan, sessions: current.plan.sessions.map((session) => session.id === sessionId ? { ...session, status: "skipped" as const } : session) } })),
    optimizePlan: () => {
      commit(optimize);
      setPlannerRevision((value) => value + 1);
    },
    resetDemo: () => commit(() => createDemoData()),
  }), [commit, data, hydrated, optimize, plannerReason, plannerStatus, syncStatus]);

  return <StudyContext.Provider value={value}>{hydrated ? children : <div className="app-loading"><span className="brand-mark">F</span><p>Dein Plan wird vorbereitet …</p></div>}</StudyContext.Provider>;
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) throw new Error("useStudy must be used inside StudyProvider");
  return context;
}
