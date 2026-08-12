import type { AvailabilityDay, CalendarItem, Exam, StudyData, UserPreferences } from "@/types/study";
import { addDays, startOfToday } from "./planner/date-utils";
import { generateStudyPlan } from "./planner";

const colors = ["#4f6f52", "#5f6b8f", "#9a6652", "#80668f", "#6f7a48"];

export const defaultPreferences: UserPreferences = {
  name: "Alex",
  onboardingCompleted: true,
  maxDailyMinutes: 180,
  bufferPercent: 0.15,
  theme: "light",
};

export const demoAvailability: AvailabilityDay[] = [
  { day: 0, enabled: true, windows: [{ id: "sun-1", start: "10:00", end: "12:00" }] },
  { day: 1, enabled: true, windows: [{ id: "mon-1", start: "16:00", end: "18:00" }] },
  { day: 2, enabled: true, windows: [{ id: "tue-1", start: "15:30", end: "17:00" }, { id: "tue-2", start: "19:00", end: "20:00" }] },
  { day: 3, enabled: true, windows: [{ id: "wed-1", start: "16:00", end: "18:30" }] },
  { day: 4, enabled: true, windows: [{ id: "thu-1", start: "17:00", end: "19:00" }] },
  { day: 5, enabled: true, windows: [{ id: "fri-1", start: "15:00", end: "17:00" }] },
  { day: 6, enabled: true, windows: [{ id: "sat-1", start: "10:00", end: "12:00" }, { id: "sat-2", start: "15:00", end: "17:00" }] },
];

export function createDemoExams(today = startOfToday()): Exam[] {
  return [
    {
      id: "exam-math",
      subject: "Mathematik",
      title: "Mathematik Klausur",
      type: "exam",
      date: addDays(today, 8),
      time: "09:00",
      size: "large",
      importance: 5,
      estimatedHours: null,
      color: colors[0],
      learningMethod: "auto",
      topics: [
        { id: "math-1", name: "Ableitungen", confidence: 3 },
        { id: "math-2", name: "Extrempunkte", confidence: 2 },
        { id: "math-3", name: "Kurvendiskussion", confidence: 2 },
        { id: "math-4", name: "Tangenten", confidence: 4 },
      ],
    },
    {
      id: "exam-bio",
      subject: "Biologie",
      title: "Biologie Test",
      type: "test",
      date: addDays(today, 12),
      size: "medium",
      importance: 3,
      estimatedHours: null,
      color: colors[1],
      learningMethod: "auto",
      topics: [
        { id: "bio-1", name: "DNA-Replikation", confidence: 3 },
        { id: "bio-2", name: "Proteinbiosynthese", confidence: 2 },
      ],
    },
    {
      id: "exam-history",
      subject: "Geschichte",
      title: "Geschichte Kurztest",
      type: "test",
      date: addDays(today, 19),
      size: "small",
      importance: 2,
      estimatedHours: null,
      color: colors[2],
      learningMethod: "auto",
      topics: [
        { id: "history-1", name: "Weimarer Republik", confidence: 3 },
        { id: "history-2", name: "Ursachen 1933", confidence: null },
      ],
    },
  ];
}

export function createDemoData(today = startOfToday()): StudyData {
  const exams = createDemoExams(today);
  const calendarItems: CalendarItem[] = [
    { id: "calendar-demo-1", title: "Training", date: addDays(today, 2), startTime: "17:00", duration: 60, kind: "appointment", status: "planned", notes: "Fester Termin" },
    { id: "calendar-demo-2", title: "Formelsammlung ordnen", date: today, startTime: "19:00", duration: 25, kind: "todo", status: "planned" },
  ];
  const plan = generateStudyPlan({ availability: demoAvailability, exams, preferences: defaultPreferences, calendarItems, now: today });
  return { preferences: defaultPreferences, availability: demoAvailability, exams, plan, feedback: [], calendarItems };
}

export const subjectColors = colors;
