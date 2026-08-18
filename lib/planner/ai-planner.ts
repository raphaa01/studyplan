import type { Exam, LearningMethodId, PlannerInput, StudyPlan, StudySessionFeedback } from "@/types/study";
import { addDays, daysBetween, minutesFromTime, startOfToday } from "./date-utils";
import { freeWindowsForDate, generateStudyPlan, plannerSlotKey } from "./planner";
import { averageUncertainty, estimateExamMinutes } from "./priority";
import { stableSubjectId } from "./subject-normalization";
import { QECORE_V108, type QECoreObservation, validateQECoreObservation } from "./model-v108";
import {
  loadQECoreV109,
  QECORE_V109,
  runQECoreV109,
  type QECoreV109Observation,
} from "./model-v109";

interface ModelTarget {
  id: string;
  kind: "exam" | "routine";
  subjectId: string;
  deadlineDay: number | null;
  difficulty: number;
  importance: number;
  investedMinutes: number;
  estimatedNeedMinutes: number;
  learningMethod: LearningMethodId;
  sessionsPerWeek: number;
  preferredSessionMinutes: number;
  flexible: boolean;
  activeFrom?: string;
  activeUntil?: string;
  feedbackDifficulty: number;
  feedbackConfidence: number;
}

interface ModelSlot {
  day: number;
  date: string;
  startMinute: number;
  endMinute: number;
}

interface TargetStats {
  indices: number[];
  ownDays: Set<number>;
  creditDays: Set<number>;
}

export interface AIPlannerResult {
  plan: StudyPlan;
  status: "ready" | "fallback";
  reason?: string;
}

const sizeDifficulty = { small: 3, medium: 5, large: 7, "very-large": 9 } as const;

function modelDifficulty(exam: Exam): number {
  const uncertaintyAdjustment = Math.round((averageUncertainty(exam) - 0.5) * 2);
  return Math.max(1, Math.min(10, sizeDifficulty[exam.size] + uncertaintyAdjustment));
}

function latestFeedback(feedback: StudySessionFeedback[], sessionIds: Set<string>) {
  const latest = feedback.filter((item) => sessionIds.has(item.sessionId)).sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];
  const difficulty = { "very-hard": 1, hard: 0.75, okay: 0.5, easy: 0.25, "very-easy": 0 } as const;
  return {
    difficulty: latest ? difficulty[latest.difficulty] : 0.5,
    confidence: latest?.confidence ? (latest.confidence - 1) / 4 : 0.5,
  };
}

function createModelTargets(input: PlannerInput, today: string): ModelTarget[] {
  const completed = (input.previousSessions ?? []).filter((session) => session.status === "completed");
  const feedback = input.feedback ?? [];
  const exams: ModelTarget[] = input.exams
    .filter((exam) => exam.date >= today)
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
    .map((exam) => {
      const sessions = completed.filter((session) => session.examId === exam.id);
      const recent = latestFeedback(feedback, new Set(sessions.map((session) => session.id)));
      return {
        id: exam.id,
        kind: "exam",
        subjectId: stableSubjectId(exam.subjectId, exam.subject),
        deadlineDay: Math.max(1, daysBetween(today, exam.date)),
        difficulty: modelDifficulty(exam),
        importance: Math.min(10, exam.importance * 2),
        investedMinutes: sessions.reduce((sum, session) => sum + session.duration, 0),
        estimatedNeedMinutes: Math.max(30, estimateExamMinutes(exam, today)),
        learningMethod: exam.learningMethod,
        sessionsPerWeek: 0,
        preferredSessionMinutes: 30,
        flexible: false,
        feedbackDifficulty: recent.difficulty,
        feedbackConfidence: recent.confidence,
      };
    });
  const routines: ModelTarget[] = (input.routines ?? [])
    .filter((routine) => routine.enabled && routine.schedulingMode !== "fixed" && (!routine.activeUntil || routine.activeUntil >= today))
    .map((routine) => {
      const sessions = completed.filter((session) => session.routineId === routine.id || session.routineCreditIds?.includes(routine.id));
      const recent = latestFeedback(feedback, new Set(sessions.map((session) => session.id)));
      return {
        id: routine.id,
        kind: "routine",
        subjectId: stableSubjectId(routine.subjectId, routine.subject),
        deadlineDay: null,
        difficulty: Math.min(10, routine.difficulty * 2),
        importance: Math.min(10, routine.importance * 2),
        investedMinutes: sessions.reduce((sum, session) => sum + session.duration, 0),
        estimatedNeedMinutes: routine.weeklyMinutes ?? routine.sessionsPerWeek * routine.preferredSessionMinutes,
        learningMethod: routine.learningMethod,
        sessionsPerWeek: routine.sessionsPerWeek,
        preferredSessionMinutes: routine.preferredSessionMinutes,
        flexible: routine.flexible,
        activeFrom: routine.activeFrom,
        activeUntil: routine.activeUntil,
        feedbackDifficulty: recent.difficulty,
        feedbackConfidence: recent.confidence,
      };
    });
  return [...exams, ...routines];
}

function planningHorizon(input: PlannerInput, targets: ModelTarget[], today: string): number {
  const examDays = targets.filter((target) => target.kind === "exam").map((target) => target.deadlineDay ?? 0);
  const routineDays = (input.routines ?? []).map((routine) => routine.activeUntil ? daysBetween(today, routine.activeUntil) + 1 : 7);
  return Math.max(1, Math.min(45, Math.max(7, ...examDays, ...routineDays)));
}

function createModelSlots(input: PlannerInput, today: string, horizon: number): ModelSlot[] {
  const slots: ModelSlot[] = [];
  for (let day = 0; day < horizon; day += 1) {
    const date = addDays(today, day);
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const availability = input.availability.find((candidate) => candidate.day === weekday && candidate.enabled);
    if (!availability) continue;
    for (const window of freeWindowsForDate(availability.windows, date, input)) {
      let cursor = minutesFromTime(window.start);
      const end = minutesFromTime(window.end);
      while (cursor + QECORE_V109.slotMinutes <= end) {
        slots.push({ day, date, startMinute: cursor, endMinute: cursor + QECORE_V109.slotMinutes });
        cursor += QECORE_V109.slotMinutes;
      }
    }
  }
  return slots;
}

function targetStats(targetIndex: number, targets: ModelTarget[], slots: ModelSlot[], assignments: number[], position: number): TargetStats {
  const target = targets[targetIndex];
  const week = Math.floor(slots[position].day / 7);
  const indices = assignments.slice(0, position).flatMap((action, index) => (
    action === targetIndex + 1 && Math.floor(slots[index].day / 7) === week ? [index] : []
  ));
  const ownDays = new Set(indices.map((index) => slots[index].day));
  const creditDays = new Set<number>();
  if (target.kind === "routine") {
    targets.forEach((candidate, index) => {
      if (candidate.kind !== "exam" || candidate.subjectId !== target.subjectId) return;
      assignments.slice(0, position).forEach((action, slotIndex) => {
        if (action === index + 1 && Math.floor(slots[slotIndex].day / 7) === week) creditDays.add(slots[slotIndex].day);
      });
    });
  }
  return { indices, ownDays, creditDays };
}

function methodProfile(target: ModelTarget) {
  let method = target.learningMethod;
  if (method === "auto") {
    method = target.kind === "exam" && (target.deadlineDay ?? 99) <= 7
      ? "exam-simulation"
      : target.difficulty >= 8
        ? "active-recall"
        : target.kind === "routine" ? "spaced-repetition" : "interleaving";
  }
  return {
    pomodoro: [1, 0.45, 0.25, 0.5, 0.45],
    "spaced-repetition": [1, 1, 0.35, 0.35, 0.75],
    interleaving: [1, 0.65, 1, 0.5, 0.6],
    "active-recall": [1, 0.85, 0.55, 0.55, 1],
    "exam-simulation": [2, 0.2, 0.05, 0.9, 0.85],
  }[method] as number[];
}

function buildObservation(targets: ModelTarget[], slots: ModelSlot[], assignments: number[], position: number): QECoreV109Observation {
  const slot = slots[position];
  const actionMask = new Uint8Array(QECORE_V109.maxTargets + 1);
  actionMask[0] = 1;
  const stats = targets.map((_, index) => targetStats(index, targets, slots, assignments, position));
  targets.forEach((target, index) => {
    let allowed = target.deadlineDay === null || slot.day < target.deadlineDay;
    if (target.kind === "routine") {
      allowed = allowed && (!target.activeFrom || slot.date >= target.activeFrom) && (!target.activeUntil || slot.date <= target.activeUntil);
      allowed = allowed && new Set([...stats[index].ownDays, ...stats[index].creditDays]).size < target.sessionsPerWeek;
    }
    actionMask[index + 1] = allowed ? 1 : 0;
  });

  const targetFeatures = new Float32Array(QECORE_V109.maxTargets * QECORE_V109.targetFeatures);
  const currentWeek = Math.floor(slot.day / 7);
  const remainingWeekSlots = slots.slice(position).filter((candidate) => Math.floor(candidate.day / 7) === currentWeek).length;
  let routineDeficit = 0;
  let examBurden = 0;
  targets.forEach((target, index) => {
    const assignedMinutes = stats[index].indices.length * QECORE_V109.slotMinutes;
    const creditedDays = new Set([...stats[index].ownDays, ...stats[index].creditDays]);
    const fulfilled = target.kind === "routine" ? Math.min(target.sessionsPerWeek, creditedDays.size) : 0;
    const remainingNeed = Math.max(target.estimatedNeedMinutes - target.investedMinutes - assignedMinutes, 0);
    if (target.kind === "routine") routineDeficit += Math.max(target.sessionsPerWeek - fulfilled, 0);
    else examBurden += remainingNeed;
    const lastDay = stats[index].indices.length ? slots[stats[index].indices.at(-1)!].day : null;
    const profile = methodProfile(target);
    targetFeatures.set([
      1,
      target.kind === "exam" ? 1 : 0,
      target.kind === "routine" ? 1 : 0,
      target.deadlineDay === null ? 0 : 1,
      Math.min((target.deadlineDay ?? 0) / 30, 2),
      Math.min(remainingNeed / 900, 2),
      Math.min((target.investedMinutes + assignedMinutes) / 900, 2),
      target.difficulty / 10,
      target.importance / 10,
      profile[0] / 4,
      profile[1], profile[2], profile[3], profile[4],
      target.sessionsPerWeek / 7,
      fulfilled / Math.max(target.sessionsPerWeek, 1),
      Math.min(remainingWeekSlots / 28, 2),
      lastDay === null ? 1 : Math.min(Math.max(slot.day - lastDay, 0) / 7, 1),
      Math.min(creditedDays.size / 7, 1),
      Math.min(stats[index].creditDays.size / Math.max(target.sessionsPerWeek, 1), 1),
      actionMask[index + 1],
      target.feedbackDifficulty,
      target.feedbackConfidence,
      target.flexible ? 1 : 0,
    ], index * QECORE_V109.targetFeatures);
  });

  const previousAction = position ? assignments[position - 1] : 0;
  let runLength = 0;
  for (let index = position - 1; index >= 0 && assignments[index] > 0; index -= 1) runLength += 1;
  const studied = assignments.slice(0, position).filter((action) => action > 0).length;
  const dailyLoad = assignments.slice(0, position).filter((action, index) => action > 0 && slots[index].day === slot.day).length;
  const previousSlot = position ? slots[position - 1] : null;
  const contiguous = previousSlot?.day === slot.day && previousSlot.endMinute === slot.startMinute;
  const flexible = targets.filter((target) => target.flexible).length;
  const globalFeatures = new Float32Array([
    (slot.day % 7) / 6,
    ((slot.day % 7) + slot.startMinute / 1440) / 7,
    position / Math.max(slots.length, 1),
    remainingWeekSlots / Math.max(slots.length, 1),
    Math.min(routineDeficit / 12, 1),
    Math.min(dailyLoad / 6, 1.5),
    Math.min(runLength / 6, 1.5),
    Math.min(examBurden / 1800, 2),
    flexible / Math.max(targets.length, 1),
    1 - flexible / Math.max(targets.length, 1),
    slot.startMinute / 1440,
    previousAction === 0 ? 1 : 0,
    0.2,
    targets.length / QECORE_V109.maxTargets,
    Math.min(studied / Math.max(slots.length, 1), 1),
    contiguous ? 1 : 0,
  ]);
  return { targets: targetFeatures, globalFeatures, actionMask };
}

function fallback(input: PlannerInput, reason: string): AIPlannerResult {
  const plan = generateStudyPlan(input);
  plan.planner = { engine: "deterministic-v1", local: true, fallbackReason: reason };
  return { plan, status: "fallback", reason };
}

export async function generateAIStudyPlan(input: PlannerInput): Promise<AIPlannerResult> {
  const today = input.now?.slice(0, 10) ?? startOfToday();
  const targets = createModelTargets(input, today);
  if (!targets.length) return fallback(input, "Keine anstehende Prüfung oder Lernroutine für die Modellplanung.");
  if (targets.length > QECORE_V109.maxTargets) {
    return fallback(input, `QECore v1.09 unterstützt höchstens ${QECORE_V109.maxTargets} gleichzeitige Lernziele.`);
  }
  const longestDeadline = Math.max(0, ...targets.map((target) => target.deadlineDay ?? 0));
  if (longestDeadline > QECORE_V109.maximumDays) {
    return fallback(input, `Der Planungshorizont überschreitet ${QECORE_V109.maximumDays} Tage.`);
  }
  const slots = createModelSlots(input, today, planningHorizon(input, targets, today));
  if (!slots.length) return fallback(input, "Es gibt noch kein vollständiges 30-Minuten-Lernfenster.");

  try {
    const weights = await loadQECoreV109();
    const assignments = new Array<number>(slots.length).fill(0);
    const started = performance.now();
    for (let position = 0; position < slots.length; position += 1) {
      assignments[position] = runQECoreV109(weights, buildObservation(targets, slots, assignments, position)).action;
    }
    const allocation = new Map<string, string | null>();
    for (let index = 0; index < slots.length; index += 1) {
      const action = assignments[index];
      allocation.set(plannerSlotKey(slots[index].date, slots[index].startMinute), action > 0 ? targets[action - 1].id : null);
    }
    return {
      plan: generateStudyPlan(input, {
        allocation: {
          slots: allocation,
          inferenceMs: performance.now() - started,
          modelSha256: QECORE_V109.weightsSha256,
          engine: QECORE_V109.id,
          rewardVersion: QECORE_V109.rewardVersion,
          idleBehavior: "fallback",
        },
      }),
      status: "ready",
    };
  } catch (error) {
    return fallback(input, error instanceof Error ? error.message : "QECore v1.09 ist nicht verfügbar.");
  }
}

export type QECoreRuntime = (observation: QECoreObservation) => Promise<{ logits: Float32Array; value: number }>;

export type QECoreActionResult = {
  action: number | null;
  fallback: boolean;
  reason?: string;
};

/** Guarded v1.08 contract retained for candidate and regression tests. */
export async function selectQECoreAction(observation: QECoreObservation, runtime: QECoreRuntime): Promise<QECoreActionResult> {
  if (!validateQECoreObservation(observation)) return { action: null, fallback: true, reason: "invalid-observation" };
  try {
    const output = await runtime(observation);
    if (output.logits.length !== QECORE_V108.maxTargets + 1 || !Number.isFinite(output.value)
      || ![...output.logits].every(Number.isFinite)) {
      return { action: null, fallback: true, reason: "invalid-model-output" };
    }
    let best = 0;
    for (let action = 1; action < output.logits.length; action += 1) {
      if (observation.actionMask[action] && output.logits[action] > output.logits[best]) best = action;
    }
    if (!observation.actionMask[best]) return { action: null, fallback: true, reason: "masked-action" };
    return { action: best, fallback: false };
  } catch {
    return { action: null, fallback: true, reason: "runtime-error" };
  }
}
