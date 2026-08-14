import type { Exam, PlannerInput, StudyPlan, StudySession, TimeWindow } from "@/types/study";
import { addDays, daysBetween, minutesFromTime, startOfToday, timeFromMinutes } from "./date-utils";
import { addBreaks } from "./break-scheduler";
import { estimateExamMinutes, examPriority, topicUncertainty } from "./priority";
import { phaseFor, spacingScore } from "./spacing";
import { rationaleFor, sessionCopy } from "./session-generator";
import { resolvedLearningMethod } from "@/lib/learning-methods";
import { stableSubjectId } from "./subject-normalization";

interface ExamState {
  exam: Exam;
  target: number;
  planned: number;
  sessionDates: string[];
  topicCounts: Map<string, number>;
  dailyTotals: Map<string, number>;
  lastTopicId: string | null;
}

export interface PlannerAllocation {
  slots: Map<string, string | null>;
  inferenceMs: number;
  modelSha256: string;
  engine: "model-v007" | "qecore-v1.09";
  rewardVersion: "2.0" | "3.0";
  idleBehavior?: "reserve" | "fallback";
}

export interface PlannerOptions {
  allocation?: PlannerAllocation;
}

export function plannerSlotKey(date: string, startMinute: number): string {
  return `${date}:${startMinute}`;
}

function chooseExam(states: ExamState[], date: string, lastExamId: string | null, streak: number): ExamState | null {
  const eligible = states.filter(({ exam, planned, target, dailyTotals }) => {
    const daysLeft = daysBetween(date, exam.date);
    const dailyCap = daysLeft <= 2 ? 180 : exam.size === "very-large" ? 130 : exam.size === "large" ? 110 : 95;
    return exam.date >= date && planned < target && (dailyTotals.get(date) ?? 0) < dailyCap;
  });
  if (!eligible.length) return null;
  return eligible.sort((a, b) => {
    const score = (state: ExamState) => {
      const remaining = Math.max(0.18, (state.target - state.planned) / state.target);
      const interleave = lastExamId === state.exam.id && streak >= 2 && eligible.length > 1 ? 0.38 : 1;
      return examPriority(state.exam, date) * remaining * spacingScore(state.sessionDates, date) * interleave;
    };
    return score(b) - score(a) || a.exam.id.localeCompare(b.exam.id);
  })[0];
}

function chooseTopic(state: ExamState) {
  return [...state.exam.topics].sort((a, b) => {
    const aCount = state.topicCounts.get(a.id) ?? 0;
    const bCount = state.topicCounts.get(b.id) ?? 0;
    const method = resolvedLearningMethod(state.exam);
    const aRepeatPenalty = method === "interleaving" && state.lastTopicId === a.id ? 0.5 : 0;
    const bRepeatPenalty = method === "interleaving" && state.lastTopicId === b.id ? 0.5 : 0;
    return (topicUncertainty(b) * 2.2 - bCount * 0.42 - bRepeatPenalty) - (topicUncertainty(a) * 2.2 - aCount * 0.42 - aRepeatPenalty) || a.name.localeCompare(b.name);
  })[0] ?? { id: `${state.exam.id}-general`, name: "Prüfungsstoff", confidence: null };
}

export function freeWindowsForDate(windows: TimeWindow[], date: string, input: PlannerInput): TimeWindow[] {
  const blocks = (input.calendarItems ?? [])
    .filter((item) => item.date === date)
    .map((item) => ({ start: minutesFromTime(item.startTime), end: minutesFromTime(item.startTime) + item.duration }))
    .sort((a, b) => a.start - b.start);
  return windows.flatMap((window) => {
    let segments = [{ start: minutesFromTime(window.start), end: minutesFromTime(window.end) }];
    for (const block of blocks) {
      segments = segments.flatMap((segment) => {
        if (block.end <= segment.start || block.start >= segment.end) return [segment];
        return [
          { start: segment.start, end: Math.min(segment.end, block.start) },
          { start: Math.max(segment.start, block.end), end: segment.end },
        ].filter((part) => part.end - part.start >= 25);
      });
    }
    return segments.map((segment, index) => ({ id: `${window.id}-free-${index}`, start: timeFromMinutes(segment.start), end: timeFromMinutes(segment.end) }));
  });
}

function methodPhase(exam: Exam, daysLeft: number, progress: number, repeat: number) {
  const method = resolvedLearningMethod(exam);
  if (method === "active-recall" && repeat > 0) return daysLeft <= 2 ? "simulation" as const : "recall" as const;
  if (method === "spaced-repetition" && repeat > 0) return daysLeft <= 2 ? "simulation" as const : "review" as const;
  if (method === "exam-simulation" && (progress >= 0.45 || daysLeft <= 4)) return "simulation" as const;
  return phaseFor(daysLeft, progress);
}

function feedbackNeedMultiplier(input: PlannerInput, sessions: StudySession[]): number {
  const feedback = (input.feedback ?? []).filter((item) => sessions.some((session) => session.id === item.sessionId));
  if (!feedback.length) return 1;
  const difficulty = { "very-hard": 1, hard: 0.75, okay: 0.5, easy: 0.25, "very-easy": 0 } as const;
  const pressure = feedback.reduce((sum, item) => {
    const confidence = item.confidence ? (item.confidence - 1) / 4 : 0.5;
    const timeRatio = (item.actualMinutes ?? item.plannedMinutes ?? 30) / Math.max(item.plannedMinutes ?? 30, 25);
    return sum + 0.32 * (difficulty[item.difficulty] - 0.5) + 0.28 * (0.5 - confidence)
      + 0.2 * (1 - Math.min(1, item.completionRate ?? 1)) + (item.missed ? 0.12 : 0)
      + 0.08 * Math.max(0, 1 - timeRatio);
  }, 0) / feedback.length;
  return Math.min(1.3, Math.max(0.75, 1 + pressure));
}

function subtractSessions(windows: TimeWindow[], date: string, sessions: StudySession[]): TimeWindow[] {
  const occupied = sessions.filter((session) => session.date === date).map((session) => ({
    start: minutesFromTime(session.startTime), end: minutesFromTime(session.startTime) + session.duration,
  }));
  return windows.flatMap((window) => {
    let segments = [{ start: minutesFromTime(window.start), end: minutesFromTime(window.end) }];
    for (const block of occupied) {
      segments = segments.flatMap((segment) => block.end <= segment.start || block.start >= segment.end ? [segment] : [
        { start: segment.start, end: Math.min(segment.end, block.start) },
        { start: Math.max(segment.start, block.end), end: segment.end },
      ].filter((part) => part.end - part.start >= 25));
    }
    return segments.map((segment, index) => ({ id: `${window.id}-study-free-${index}`, start: timeFromMinutes(segment.start), end: timeFromMinutes(segment.end) }));
  });
}

export function generateStudyPlan(input: PlannerInput, options: PlannerOptions = {}): StudyPlan {
  const today = input.now?.slice(0, 10) ?? startOfToday();
  const activeExams = input.exams.filter((exam) => exam.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const rangeEnd = [activeExams.at(-1)?.date, addDays(today, 7), ...(input.routines ?? []).map((routine) => routine.activeUntil)]
    .filter((value): value is string => Boolean(value)).sort().at(-1) ?? addDays(today, 7);
  const completed = (input.previousSessions ?? []).filter((session) => session.status === "completed");
  const states: ExamState[] = activeExams.map((exam) => {
    const done = completed.filter((session) => session.examId === exam.id);
    return {
      exam,
      target: Math.max(25, Math.round(estimateExamMinutes(exam, today) * feedbackNeedMultiplier(input, done)) - done.reduce((sum, session) => sum + session.duration, 0)),
      planned: 0,
      sessionDates: done.map((session) => session.date).sort(),
      topicCounts: new Map(exam.topics.map((topic) => [topic.id, done.filter((session) => session.topicId === topic.id).length])),
      dailyTotals: new Map(),
      lastTopicId: null,
    };
  });
  const learningSessions: StudySession[] = [];
  const maxDaily = input.preferences?.maxDailyMinutes ?? 180;
  const buffer = Math.min(0.35, Math.max(0, input.preferences?.bufferPercent ?? 0.15));
  let sequence = 1;

  for (let offset = 0; offset <= Math.min(45, daysBetween(today, rangeEnd)); offset += 1) {
    const date = addDays(today, offset);
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const day = input.availability.find((item) => item.day === weekday && item.enabled);
    if (!day) continue;
    let dailyLearning = 0;
    let lastExamId: string | null = null;
    let streak = 0;

    for (const window of freeWindowsForDate(day.windows, date, input)) {
      let cursor = minutesFromTime(window.start);
      const end = minutesFromTime(window.end);
      let consecutiveModelSlots = 0;
      while (cursor + 25 <= end && dailyLearning < maxDaily) {
        const slotKey = plannerSlotKey(date, cursor);
        const hasModelDecision = options.allocation?.slots.has(slotKey) ?? false;
        const modelTargetId = hasModelDecision ? options.allocation?.slots.get(slotKey) : undefined;
        const modelRoutine = modelTargetId
          ? (input.routines ?? []).find((routine) => routine.id === modelTargetId)
          : undefined;
        if (hasModelDecision && modelRoutine) {
          cursor += 30;
          consecutiveModelSlots = 0;
          streak = 0;
          lastExamId = null;
          continue;
        }
        if (hasModelDecision && modelTargetId === null && options.allocation?.idleBehavior !== "fallback") {
          cursor += 30;
          consecutiveModelSlots = 0;
          streak = 0;
          lastExamId = null;
          continue;
        }
        if (hasModelDecision && consecutiveModelSlots >= 2) {
          cursor += 30;
          consecutiveModelSlots = 0;
          streak = 0;
          lastExamId = null;
          continue;
        }
        const recommended: ExamState | null = modelTargetId
          ? states.find(({ exam, planned, target, dailyTotals }) => exam.id === modelTargetId
            && exam.date >= date
            && planned < target
            && (dailyTotals.get(date) ?? 0) < maxDaily) ?? null
          : null;
        const allowDeterministicChoice = !hasModelDecision || options.allocation?.idleBehavior === "fallback";
        const state: ExamState | null = recommended ?? (allowDeterministicChoice ? chooseExam(states, date, lastExamId, streak) : null);
        if (hasModelDecision && !state) {
          cursor += 30;
          continue;
        }
        if (!state) break;
        const remainingWindow = end - cursor;
        const remainingTarget = state.target - state.planned;
        const method = resolvedLearningMethod(state.exam);
        const desired = hasModelDecision
          ? method === "pomodoro" ? 25 : 30
          : method === "pomodoro" ? 25 : remainingWindow < 45 ? Math.max(25, remainingWindow) : remainingWindow >= 65 ? 50 : 40;
        const duration = Math.min(desired, remainingTarget, maxDaily - dailyLearning);
        if (duration < 25) break;
        const topic = chooseTopic(state);
        const progress = Math.min(1, state.planned / state.target);
        const daysLeft = Math.max(0, daysBetween(date, state.exam.date));
        const repeat = state.topicCounts.get(topic.id) ?? 0;
        const type = methodPhase(state.exam, daysLeft, progress, repeat);
        const copy = sessionCopy(state.exam, topic, type, duration);
        const intensity = type === "simulation" || topic.confidence === 1 ? "high" : type === "review" ? "light" : "medium";
        learningSessions.push({
          id: `session-${date}-${sequence}`,
          examId: state.exam.id,
          routineId: null,
          routineCreditIds: (input.routines ?? []).filter((routine) => routine.enabled
            && stableSubjectId(routine.subjectId, routine.subject) === stableSubjectId(state.exam.subjectId, state.exam.subject))
            .map((routine) => routine.id),
          topicId: topic.id,
          date,
          startTime: timeFromMinutes(cursor),
          duration,
          type,
          title: copy.title,
          description: copy.description,
          status: "planned",
          rationale: rationaleFor(state.exam, topic, daysLeft, type, repeat),
          intensity,
          sequence,
        });
        sequence += 1;
        state.planned += duration;
        state.dailyTotals.set(date, (state.dailyTotals.get(date) ?? 0) + duration);
        state.sessionDates.push(date);
        state.topicCounts.set(topic.id, repeat + 1);
        state.lastTopicId = topic.id;
        dailyLearning += duration;
        if (hasModelDecision) consecutiveModelSlots += 1;
        streak = lastExamId === state.exam.id ? streak + 1 : 1;
        lastExamId = state.exam.id;
        const plannedBreak = dailyLearning >= maxDaily ? 0 : streak % 3 === 0 ? 20 : 10;
        cursor += hasModelDecision ? 30 : duration + plannedBreak;
        if (remainingWindow * (1 - buffer) < 25) break;
      }
    }
  }

  // Flexible routine pass: exams are already placed and count once toward a same-subject weekly goal.
  for (let offset = 0; offset <= Math.min(45, daysBetween(today, rangeEnd)); offset += 1) {
    const date = addDays(today, offset);
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const availability = input.availability.find((item) => item.day === weekday && item.enabled);
    if (!availability) continue;
    for (const routine of (input.routines ?? []).filter((item) => item.enabled
      && (!item.activeFrom || item.activeFrom <= date) && (!item.activeUntil || item.activeUntil >= date))) {
      if (routine.preferredWeekdays?.length && !routine.preferredWeekdays.includes(weekday)) continue;
      const weekStart = addDays(today, Math.floor(offset / 7) * 7);
      const weekEnd = addDays(weekStart, 6);
      const creditedDays = new Set(learningSessions.filter((session) => session.date >= weekStart && session.date <= weekEnd
        && (session.routineId === routine.id || session.routineCreditIds?.includes(routine.id))).map((session) => session.date));
      if (creditedDays.size >= routine.sessionsPerWeek || creditedDays.has(date)) continue;
      const usedToday = learningSessions.filter((session) => session.date === date).reduce((sum, session) => sum + session.duration, 0);
      if (usedToday >= maxDaily) continue;
      const freeWindows = subtractSessions(freeWindowsForDate(availability.windows, date, input), date, learningSessions);
      const modelStart = options.allocation
        ? [...options.allocation.slots].find(([key, targetId]) => targetId === routine.id && key.startsWith(`${date}:`))
        : undefined;
      const modelStartMinute = modelStart ? Number(modelStart[0].slice(modelStart[0].lastIndexOf(":") + 1)) : null;
      const containingWindow = modelStartMinute === null ? undefined : freeWindows.find((window) => (
        minutesFromTime(window.start) <= modelStartMinute && minutesFromTime(window.end) >= modelStartMinute + 25
      ));
      const free = containingWindow && modelStartMinute !== null
        ? { ...containingWindow, start: timeFromMinutes(modelStartMinute) }
        : freeWindows[0];
      if (!free) continue;
      const method = routine.learningMethod === "auto" ? "spaced-repetition" : routine.learningMethod;
      const desired = method === "pomodoro" ? 25 : method === "exam-simulation" ? 60 : routine.preferredSessionMinutes;
      const duration = Math.min(desired, minutesFromTime(free.end) - minutesFromTime(free.start), maxDaily - usedToday);
      if (duration < 25) continue;
      learningSessions.push({
        id: `routine-${routine.id}-${date}-${sequence}`, examId: null, routineId: routine.id, routineCreditIds: [], topicId: null,
        date, startTime: free.start, duration, type: method === "active-recall" ? "recall" : method === "exam-simulation" ? "simulation" : "practice",
        title: routine.title, description: `Flexible ${routine.subject}-Routine nach der gewählten Lernmethode.`, status: "planned",
        rationale: `Erfüllt Einheit ${creditedDays.size + 1} von ${routine.sessionsPerWeek}; Prüfungsvorbereitung hatte Vorrang.`,
        intensity: routine.difficulty >= 4 ? "high" : routine.difficulty <= 2 ? "light" : "medium", sequence,
      });
      sequence += 1;
    }
  }

  const preserved = (input.previousSessions ?? []).filter((session) => session.status === "completed" || session.status === "skipped");
  const sessions = [...preserved, ...addBreaks(learningSessions, input.calendarItems)].sort((a, b) => `${a.date}${a.startTime}${a.sequence}`.localeCompare(`${b.date}${b.startTime}${b.sequence}`));
  return {
    id: `plan-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    rangeStart: today,
    rangeEnd,
    sessions,
    planner: options.allocation ? {
      engine: options.allocation.engine,
      rewardVersion: options.allocation.rewardVersion,
      inferenceMs: options.allocation.inferenceMs,
      modelSha256: options.allocation.modelSha256,
      local: true,
    } : {
      engine: "deterministic-v1",
      local: true,
    },
  };
}
