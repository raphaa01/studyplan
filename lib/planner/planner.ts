import type { Exam, PlannerInput, StudyPlan, StudySession } from "@/types/study";
import { addDays, daysBetween, minutesFromTime, startOfToday, timeFromMinutes } from "./date-utils";
import { addBreaks } from "./break-scheduler";
import { estimateExamMinutes, examPriority, topicUncertainty } from "./priority";
import { phaseFor, spacingScore } from "./spacing";
import { rationaleFor, sessionCopy } from "./session-generator";

interface ExamState {
  exam: Exam;
  target: number;
  planned: number;
  sessionDates: string[];
  topicCounts: Map<string, number>;
  dailyTotals: Map<string, number>;
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
    return (topicUncertainty(b) * 2.2 - bCount * 0.42) - (topicUncertainty(a) * 2.2 - aCount * 0.42) || a.name.localeCompare(b.name);
  })[0] ?? { id: `${state.exam.id}-general`, name: "Prüfungsstoff", confidence: null };
}

export function generateStudyPlan(input: PlannerInput): StudyPlan {
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

    for (const window of day.windows) {
      let cursor = minutesFromTime(window.start);
      const end = minutesFromTime(window.end);
      while (cursor + 25 <= end && dailyLearning < maxDaily) {
        const state = chooseExam(states, date, lastExamId, streak);
        if (!state) break;
        const remainingWindow = end - cursor;
        const remainingTarget = state.target - state.planned;
        const desired = remainingWindow < 45 ? Math.max(25, remainingWindow) : remainingWindow >= 65 ? 50 : 40;
        const duration = Math.min(desired, remainingTarget, maxDaily - dailyLearning);
        if (duration < 25) break;
        const topic = chooseTopic(state);
        const progress = Math.min(1, state.planned / state.target);
        const daysLeft = Math.max(0, daysBetween(date, state.exam.date));
        const type = phaseFor(daysLeft, progress);
        const repeat = state.topicCounts.get(topic.id) ?? 0;
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
        dailyLearning += duration;
        streak = lastExamId === state.exam.id ? streak + 1 : 1;
        lastExamId = state.exam.id;
        const plannedBreak = dailyLearning >= maxDaily ? 0 : streak % 3 === 0 ? 20 : 10;
        cursor += duration + plannedBreak;
        if (remainingWindow * (1 - buffer) < 25) break;
      }
    }
  }

  const preserved = (input.previousSessions ?? []).filter((session) => session.status === "completed" || session.status === "skipped");
  const sessions = [...preserved, ...addBreaks(learningSessions)].sort((a, b) => `${a.date}${a.startTime}${a.sequence}`.localeCompare(`${b.date}${b.startTime}${b.sequence}`));
  return {
    id: `plan-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    rangeStart: today,
    rangeEnd,
    sessions,
  };
}
