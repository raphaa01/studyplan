import type { ActivityRecord, CalendarItem, Exam, StudySession, StudySessionFeedback } from "@/types/study";

export type StatisticsRange = "12-weeks" | "6-months" | "all";

export interface TimelinePoint {
  key: string;
  label: string;
  fullLabel: string;
  studyMinutes: number;
  studyCount: number;
  todoCount: number;
}

export interface SubjectStatistic {
  subject: string;
  minutes: number;
  sessions: number;
  share: number;
}

export interface StatisticsSnapshot {
  totalStudyMinutes: number;
  completedStudySessions: number;
  completedTodos: number;
  activeDays: number;
  averageSessionMinutes: number;
  timeline: TimelinePoint[];
  timelineStudyMinutes: number;
  timelineStudySessions: number;
  timelineTodos: number;
  subjects: SubjectStatistic[];
  recent: ActivityRecord[];
}

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - mondayOffset);
  return result;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function studyRecord(session: StudySession, exams: Exam[], feedback: StudySessionFeedback[]): ActivityRecord {
  const exam = exams.find((candidate) => candidate.id === session.examId);
  const completedAt = feedback.find((item) => item.sessionId === session.id)?.completedAt
    ?? `${session.date}T${session.startTime}:00`;
  return {
    id: `activity-study-${session.id}`,
    sourceId: session.id,
    kind: "study",
    title: session.title,
    subject: exam?.subject ?? "Lernen",
    durationMinutes: session.duration,
    completedAt,
  };
}

function todoRecord(item: CalendarItem): ActivityRecord {
  return {
    id: `activity-todo-${item.id}`,
    sourceId: item.id,
    kind: "todo",
    title: item.title,
    durationMinutes: item.duration,
    completedAt: item.completedAt ?? `${item.date}T${item.startTime}:00`,
  };
}

export function backfillActivityLog(
  existing: ActivityRecord[] | undefined,
  sessions: StudySession[],
  exams: Exam[],
  feedback: StudySessionFeedback[],
  calendarItems: CalendarItem[],
): ActivityRecord[] {
  if (existing) return existing;
  return [
    ...sessions.filter((session) => session.type !== "break" && session.status === "completed").map((session) => studyRecord(session, exams, feedback)),
    ...calendarItems.filter((item) => item.kind === "todo" && item.status === "completed").map(todoRecord),
  ].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

export function appendActivityRecord(records: ActivityRecord[], record: ActivityRecord): ActivityRecord[] {
  return records.some((item) => item.kind === record.kind && item.sourceId === record.sourceId)
    ? records
    : [...records, record];
}

export function createStudyActivity(session: StudySession, exam: Exam | undefined, completedAt: string): ActivityRecord {
  return {
    id: `activity-study-${session.id}`,
    sourceId: session.id,
    kind: "study",
    title: session.title,
    subject: exam?.subject ?? "Lernen",
    durationMinutes: session.duration,
    completedAt,
  };
}

export function createTodoActivity(item: CalendarItem, completedAt: string): ActivityRecord {
  return {
    id: `activity-todo-${item.id}`,
    sourceId: item.id,
    kind: "todo",
    title: item.title,
    durationMinutes: item.duration,
    completedAt,
  };
}

function weeklyTimeline(records: ActivityRecord[], now: Date): TimelinePoint[] {
  const first = addDays(startOfWeek(now), -77);
  return Array.from({ length: 12 }, (_, index) => {
    const start = addDays(first, index * 7);
    const end = addDays(start, 7);
    const bucket = records.filter((record) => {
      const date = validDate(record.completedAt);
      return date && date >= start && date < end;
    });
    return timelinePoint(localIso(start), new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(start), `Woche ab ${new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long" }).format(start)}`, bucket);
  });
}

function monthlyTimeline(records: ActivityRecord[], now: Date, range: StatisticsRange): TimelinePoint[] {
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const earliest = records.reduce<Date | null>((oldest, record) => {
    const date = validDate(record.completedAt);
    return date && (!oldest || date < oldest) ? date : oldest;
  }, null);
  const first = range === "6-months" || !earliest
    ? addMonths(currentMonth, -5)
    : new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const count = Math.max(1, (currentMonth.getFullYear() - first.getFullYear()) * 12 + currentMonth.getMonth() - first.getMonth() + 1);
  return Array.from({ length: count }, (_, index) => {
    const start = addMonths(first, index);
    const end = addMonths(first, index + 1);
    const bucket = records.filter((record) => {
      const date = validDate(record.completedAt);
      return date && date >= start && date < end;
    });
    return timelinePoint(`${start.getFullYear()}-${start.getMonth()}`, new Intl.DateTimeFormat("de-DE", { month: "short" }).format(start).replace(".", ""), new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(start), bucket);
  });
}

function timelinePoint(key: string, label: string, fullLabel: string, records: ActivityRecord[]): TimelinePoint {
  const study = records.filter((record) => record.kind === "study");
  return {
    key,
    label,
    fullLabel,
    studyMinutes: study.reduce((sum, record) => sum + record.durationMinutes, 0),
    studyCount: study.length,
    todoCount: records.filter((record) => record.kind === "todo").length,
  };
}

export function buildStatistics(records: ActivityRecord[], range: StatisticsRange, now = new Date()): StatisticsSnapshot {
  const validRecords = records.filter((record) => validDate(record.completedAt));
  const study = validRecords.filter((record) => record.kind === "study");
  const todos = validRecords.filter((record) => record.kind === "todo");
  const totalStudyMinutes = study.reduce((sum, record) => sum + record.durationMinutes, 0);
  const subjectMap = new Map<string, { minutes: number; sessions: number }>();
  for (const record of study) {
    const subject = record.subject ?? "Lernen";
    const current = subjectMap.get(subject) ?? { minutes: 0, sessions: 0 };
    subjectMap.set(subject, { minutes: current.minutes + record.durationMinutes, sessions: current.sessions + 1 });
  }
  const timeline = range === "12-weeks" ? weeklyTimeline(validRecords, now) : monthlyTimeline(validRecords, now, range);
  const subjects = [...subjectMap.entries()]
    .map(([subject, value]) => ({ subject, ...value, share: totalStudyMinutes ? value.minutes / totalStudyMinutes * 100 : 0 }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    totalStudyMinutes,
    completedStudySessions: study.length,
    completedTodos: todos.length,
    activeDays: new Set(validRecords.map((record) => localIso(validDate(record.completedAt)!))).size,
    averageSessionMinutes: study.length ? Math.round(totalStudyMinutes / study.length) : 0,
    timeline,
    timelineStudyMinutes: timeline.reduce((sum, point) => sum + point.studyMinutes, 0),
    timelineStudySessions: timeline.reduce((sum, point) => sum + point.studyCount, 0),
    timelineTodos: timeline.reduce((sum, point) => sum + point.todoCount, 0),
    subjects,
    recent: [...validRecords].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 8),
  };
}

export function activityDateLabel(value: string): string {
  const date = validDate(value);
  if (!date) return "Unbekannt";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
