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
export type LearningMethodId = "auto" | "active-recall" | "spaced-repetition" | "interleaving" | "pomodoro" | "exam-simulation";
export type CalendarItemKind = "appointment" | "todo";
export type CalendarItemStatus = "planned" | "completed";
export type ActivityKind = "study" | "todo";

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
  subjectId?: string;
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
  learningMethod: LearningMethodId;
}

export interface LearningRoutine {
  id: string;
  subjectId: string;
  subject: string;
  title: string;
  sessionsPerWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  preferredSessionMinutes: number;
  importance: 1 | 2 | 3 | 4 | 5;
  difficulty: 1 | 2 | 3 | 4 | 5;
  learningMethod: LearningMethodId;
  topics?: string[];
  preferredWeekdays?: number[];
  activeFrom?: string;
  activeUntil?: string;
  flexible: boolean;
  enabled: boolean;
}

export interface CalendarItem {
  id: string;
  title: string;
  date: string;
  startTime: string;
  duration: number;
  kind: CalendarItemKind;
  status: CalendarItemStatus;
  completedAt?: string;
  notes?: string;
}

export interface ActivityRecord {
  id: string;
  sourceId: string;
  kind: ActivityKind;
  title: string;
  subject?: string;
  durationMinutes: number;
  completedAt: string;
}

export interface StudySession {
  id: string;
  examId: string | null;
  routineId?: string | null;
  routineCreditIds?: string[];
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
  completionRate?: number;
  missed?: boolean;
  plannedMinutes?: number;
  actualMinutes?: number;
}

export interface LearningSessionProgress {
  sessionId: string;
  remainingSeconds: number;
  runningSince: string | null;
  stage: 0 | 1 | 2 | 3;
  checkedTaskIds: string[];
  revealedRecallIds: string[];
  reflection: string;
  updatedAt: string;
}

export interface TodoFocusProgress {
  itemId: string;
  remainingSeconds: number;
  runningSince: string | null;
  updatedAt: string;
}

export interface StudyPlan {
  id: string;
  generatedAt: string;
  rangeStart: string;
  rangeEnd: string;
  sessions: StudySession[];
  planner?: {
    engine: "model-v007" | "deterministic-v1";
    rewardVersion?: "2.0";
    inferenceMs?: number;
    modelSha256?: string;
    local: boolean;
    fallbackReason?: string;
  };
}

export interface StudyData {
  preferences: UserPreferences;
  availability: AvailabilityDay[];
  exams: Exam[];
  plan: StudyPlan;
  feedback: StudySessionFeedback[];
  calendarItems: CalendarItem[];
  learningProgress: Record<string, LearningSessionProgress>;
  todoFocusProgress: Record<string, TodoFocusProgress>;
  activityLog: ActivityRecord[];
}

export interface PlannerInput {
  availability: AvailabilityDay[];
  exams: Exam[];
  routines?: LearningRoutine[];
  previousSessions?: StudySession[];
  feedback?: StudySessionFeedback[];
  calendarItems?: CalendarItem[];
  preferences?: Partial<UserPreferences>;
  now?: string;
}
