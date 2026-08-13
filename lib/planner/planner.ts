import type { Exam, PlannerInput, StudyPlan, StudySession, TimeWindow } from "@/types/study";
import { addDays, daysBetween, minutesFromTime, startOfToday, timeFromMinutes } from "./date-utils";
import { addBreaks } from "./break-scheduler";
import { estimateExamMinutes, examPriority, topicUncertainty } from "./priority";
import { phaseFor, spacingScore } from "./spacing";
import { rationaleFor, sessionCopy } from "./session-generator";
import { resolvedLearningMethod } from "@/lib/learning-methods";

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

export function generateStudyPlan(input: PlannerInput, options: PlannerOptions = {}): StudyPlan {
  const today = input.now?.slice(0, 10) ?? startOfToday();
  const activeExams = input.exams.filter((exam) => exam.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const rangeEnd = activeExams.at(-1)?.date ?? addDays(today, 7);
  const completed = (input.previousSessions ?? []).filter((session) => session.status === "completed");
  const states: ExamState[] = activeExams.map((exam) => {
    const done = completed.filter((session) => session.examId === exam.id);
    return {
      exam,
      target: Math.max(25, estimateExamMinutes(exam, today) - done.reduce((sum, session) => sum + session.duration, 0)),
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
        const modelExamId = hasModelDecision ? options.allocation?.slots.get(slotKey) : undefined;
        if (hasModelDecision && modelExamId === null) {
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
        const recommended: ExamState | null = modelExamId
          ? states.find(({ exam, planned, target, dailyTotals }) => exam.id === modelExamId
            && exam.date >= date
            && planned < target
            && (dailyTotals.get(date) ?? 0) < maxDaily) ?? null
          : null;
        const state: ExamState | null = recommended ?? (hasModelDecision ? null : chooseExam(states, date, lastExamId, streak));
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

  const preserved = (input.previousSessions ?? []).filter((session) => session.status === "completed" || session.status === "skipped");
  const sessions = [...preserved, ...addBreaks(learningSessions, input.calendarItems)].sort((a, b) => `${a.date}${a.startTime}${a.sequence}`.localeCompare(`${b.date}${b.startTime}${b.sequence}`));
  return {
    id: `plan-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    rangeStart: today,
    rangeEnd,
    sessions,
    planner: options.allocation ? {
      engine: "model-v007",
      rewardVersion: "2.0",
      inferenceMs: options.allocation.inferenceMs,
      modelSha256: options.allocation.modelSha256,
      local: true,
    } : {
      engine: "deterministic-v1",
      local: true,
    },
  };
}
