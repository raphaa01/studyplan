import type { Exam, ExamSize, ExamTopic } from "@/types/study";
import { daysBetween } from "./date-utils";

const sizeWeight: Record<ExamSize, number> = {
  small: 0.75,
  medium: 1,
  large: 1.35,
  "very-large": 1.7,
};

export function topicUncertainty(topic: ExamTopic): number {
  return topic.confidence === null ? 0.62 : (6 - topic.confidence) / 5;
}

export function averageUncertainty(exam: Exam): number {
  if (!exam.topics.length) return 0.62;
  return exam.topics.reduce((sum, topic) => sum + topicUncertainty(topic), 0) / exam.topics.length;
}

export function examPriority(exam: Exam, date: string): number {
  const days = Math.max(0, daysBetween(date, exam.date));
  const urgency = 1 + 10 / Math.pow(days + 1, 0.88);
  const importance = 0.7 + exam.importance * 0.18;
  const uncertainty = 0.75 + averageUncertainty(exam) * 0.8;
  return urgency * sizeWeight[exam.size] * importance * uncertainty;
}

export function estimateExamMinutes(exam: Exam, today: string): number {
  if (exam.estimatedHours && exam.estimatedHours > 0) return Math.round(exam.estimatedHours * 60);
  const baseHours: Record<ExamSize, number> = { small: 2, medium: 4, large: 7, "very-large": 10 };
  const topicFactor = Math.max(0.85, Math.min(1.55, 0.7 + exam.topics.length * 0.11));
  const uncertaintyFactor = 0.85 + averageUncertainty(exam) * 0.7;
  const days = Math.max(1, daysBetween(today, exam.date));
  const realisticCompression = days < 3 ? 0.62 : days < 7 ? 0.82 : 1;
  return Math.round(baseHours[exam.size] * topicFactor * uncertaintyFactor * realisticCompression * 60);
}
