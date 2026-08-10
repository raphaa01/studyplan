export type ExamType = "exam" | "test" | "oral" | "presentation" | "other";
export type ExamSize = "small" | "medium" | "large" | "very-large";
export type Confidence = 1 | 2 | 3 | 4 | 5 | null;
export type SessionType =
  | "understand"
  | "practice"
  | "recall"
  | "simulation"
  | "review"
  | "break";
export type SessionStatus = "planned" | "completed" | "missed" | "skipped";

export interface TimeWindow {
  id: string;
  start: string;
  end: string;
}

export interface AvailabilityDay {
  day: number;
  enabled: boolean;
  windows: TimeWindow[];
}

export interface UserPreferences {
  name: string;
  onboardingCompleted: boolean;
  maxDailyMinutes: number;
  bufferPercent: number;
  theme: "light" | "dark" | "system";
}

export interface ExamTopic {
  id: string;
  name: string;
  confidence: Confidence;
}

export interface Exam {
  id: string;
  subject: string;
  title: string;
  type: ExamType;
  date: string;
  time?: string;
  size: ExamSize;
  importance: 1 | 2 | 3 | 4 | 5;
  estimatedHours: number | null;
  color: string;
  topics: ExamTopic[];
}

export interface StudySession {
  id: string;
  examId: string | null;
  topicId: string | null;
  date: string;
  startTime: string;
  duration: number;
  type: SessionType;
  title: string;
  description: string;
  status: SessionStatus;
  rationale: string;
  intensity: "light" | "medium" | "high";
  sequence: number;
}

export interface StudySessionFeedback {
  sessionId: string;
  difficulty: "very-hard" | "hard" | "okay" | "easy" | "very-easy";
  confidence: Confidence;
  completedAt: string;
}

export interface StudyPlan {
  id: string;
  generatedAt: string;
  rangeStart: string;
  rangeEnd: string;
  sessions: StudySession[];
}

export interface StudyData {
  preferences: UserPreferences;
  availability: AvailabilityDay[];
  exams: Exam[];
  plan: StudyPlan;
  feedback: StudySessionFeedback[];
}

export interface PlannerInput {
  availability: AvailabilityDay[];
  exams: Exam[];
  previousSessions?: StudySession[];
  feedback?: StudySessionFeedback[];
  preferences?: Partial<UserPreferences>;
  now?: string;
}
