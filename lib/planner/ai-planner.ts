import type { Exam, PlannerInput, StudyPlan } from "@/types/study";
import { addDays, daysBetween, minutesFromTime, startOfToday } from "./date-utils";
import { freeWindowsForDate, generateStudyPlan, plannerSlotKey } from "./planner";
import { averageUncertainty, estimateExamMinutes } from "./priority";
import { loadModelV007, PLANNER_MODEL_V007, runModelV007, type ModelV007Observation } from "./model-v007";

interface ModelExam {
  exam: Exam;
  daysUntil: number;
  difficulty: number;
  importance: number;
  investedMinutes: number;
  estimatedNeedMinutes: number;
}

interface ModelSlot {
  day: number;
  date: string;
  startMinute: number;
  endMinute: number;
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

function createModelExams(input: PlannerInput, today: string): ModelExam[] {
  const completed = (input.previousSessions ?? []).filter((session) => session.status === "completed");
  return input.exams
    .filter((exam) => exam.date >= today)
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
    .map((exam) => ({
      exam,
      daysUntil: Math.max(1, daysBetween(today, exam.date)),
      difficulty: modelDifficulty(exam),
      importance: Math.min(10, exam.importance * 2),
      investedMinutes: completed.filter((session) => session.examId === exam.id).reduce((sum, session) => sum + session.duration, 0),
      estimatedNeedMinutes: Math.max(30, estimateExamMinutes(exam, today)),
    }));
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
      while (cursor + PLANNER_MODEL_V007.slotMinutes <= end) {
        slots.push({ day, date, startMinute: cursor, endMinute: cursor + PLANNER_MODEL_V007.slotMinutes });
        cursor += PLANNER_MODEL_V007.slotMinutes;
      }
    }
  }
  return slots;
}

function buildObservation(exams: ModelExam[], slots: ModelSlot[], assignments: number[], position: number): ModelV007Observation {
  const slot = slots[position];
  const examFeatures = new Float32Array(PLANNER_MODEL_V007.maximumExams * 11);
  const previousAction = position > 0 ? assignments[position - 1] : 0;
  for (let index = 0; index < exams.length; index += 1) {
    const modelExam = exams[index];
    const assignedIndices: number[] = [];
    for (let slotIndex = 0; slotIndex < position; slotIndex += 1) if (assignments[slotIndex] === index + 1) assignedIndices.push(slotIndex);
    const assignedMinutes = assignedIndices.length * PLANNER_MODEL_V007.slotMinutes;
    const studyDays = new Set(assignedIndices.map((slotIndex) => slots[slotIndex].day));
    const lastDay = assignedIndices.length ? slots[assignedIndices.at(-1)!].day : -1;
    const need = Math.max(modelExam.estimatedNeedMinutes, 30);
    const offset = index * 11;
    examFeatures.set([
      modelExam.difficulty / 10,
      modelExam.importance / 10,
      Math.min(modelExam.daysUntil / 30, 2),
      modelExam.exam.type === "test" ? 0 : 1,
      Math.min(modelExam.investedMinutes / need, 2),
      Math.min(assignedMinutes / need, 2),
      Math.max(0, 1 - (modelExam.investedMinutes + assignedMinutes) / need),
      Math.min(studyDays.size / 5, 1),
      previousAction === index + 1 ? 1 : 0,
      lastDay >= 0 ? Math.min(Math.max(slot.day - lastDay, 0) / 7, 1) : 1,
      slot.day < modelExam.daysUntil ? 1 : 0,
    ], offset);
  }

  let studied = 0;
  for (let index = 0; index < position; index += 1) if (assignments[index] > 0) studied += 1;
  let runLength = 0;
  for (let index = position - 1; index >= 0 && assignments[index] > 0; index -= 1) runLength += 1;
  const previousSlot = position > 0 ? slots[position - 1] : null;
  const sameDay = previousSlot?.day === slot.day;
  const contiguous = Boolean(sameDay && previousSlot?.endMinute === slot.startMinute);
  const totalNeed = exams.reduce((sum, exam) => sum + exam.estimatedNeedMinutes, 0);
  const globalFeatures = new Float32Array([
    Math.min(slot.day / 30, 2),
    slot.startMinute / (24 * 60),
    position / Math.max(slots.length, 1),
    (slots.length - position) / Math.max(slots.length, 1),
    Math.min(runLength / 6, 1.5),
    previousAction === 0 ? 1 : 0,
    1,
    exams.length / PLANNER_MODEL_V007.maximumExams,
    Math.min(studied * PLANNER_MODEL_V007.slotMinutes / Math.max(totalNeed, 30), 2),
    sameDay ? 1 : 0,
    contiguous ? 1 : 0,
    1,
  ]);
  const actionMask = Array.from({ length: PLANNER_MODEL_V007.maximumExams + 1 }, (_, index) => (
    index === 0 || (index <= exams.length && slot.day < exams[index - 1].daysUntil)
  ));
  return { exams: examFeatures, globalFeatures, actionMask };
}

function fallback(input: PlannerInput, reason: string): AIPlannerResult {
  const plan = generateStudyPlan(input);
  plan.planner = { engine: "deterministic-v1", local: true, fallbackReason: reason };
  return { plan, status: "fallback", reason };
}

export async function generateAIStudyPlan(input: PlannerInput): Promise<AIPlannerResult> {
  const today = input.now?.slice(0, 10) ?? startOfToday();
  const exams = createModelExams(input, today);
  if (!exams.length) return fallback(input, "Keine anstehende Prüfung für die Modellplanung.");
  if (exams.length > PLANNER_MODEL_V007.maximumExams) {
    return fallback(input, `model-v007 unterstützt höchstens ${PLANNER_MODEL_V007.maximumExams} gleichzeitige Prüfungen.`);
  }
  const horizon = Math.max(...exams.map((exam) => exam.daysUntil));
  if (horizon > PLANNER_MODEL_V007.maximumDays) {
    return fallback(input, `Der Planungshorizont überschreitet ${PLANNER_MODEL_V007.maximumDays} Tage.`);
  }
  const slots = createModelSlots(input, today, horizon);
  if (!slots.length) return fallback(input, "Es gibt noch kein vollständiges 30-Minuten-Lernfenster.");

  try {
    const weights = await loadModelV007();
    const assignments = new Array<number>(slots.length).fill(0);
    const started = performance.now();
    for (let position = 0; position < slots.length; position += 1) {
      assignments[position] = runModelV007(weights, buildObservation(exams, slots, assignments, position)).action;
    }
    const allocation = new Map<string, string | null>();
    for (let index = 0; index < slots.length; index += 1) {
      const action = assignments[index];
      allocation.set(plannerSlotKey(slots[index].date, slots[index].startMinute), action > 0 ? exams[action - 1].exam.id : null);
    }
    return {
      plan: generateStudyPlan(input, {
        allocation: {
          slots: allocation,
          inferenceMs: performance.now() - started,
          modelSha256: PLANNER_MODEL_V007.weightsSha256,
        },
      }),
      status: "ready",
    };
  } catch (error) {
    return fallback(input, error instanceof Error ? error.message : "Das lokale Planungsmodell ist nicht verfügbar.");
  }
}
