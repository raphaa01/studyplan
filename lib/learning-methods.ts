import type { Exam, LearningMethodId } from "@/types/study";

export interface LearningMethod {
  id: Exclude<LearningMethodId, "auto">;
  name: string;
  shortName: string;
  summary: string;
  bestFor: string;
  cadence: string;
  evidence: string;
  sourceUrl: string;
}

export const learningMethods: LearningMethod[] = [
  {
    id: "active-recall",
    name: "Active Recall",
    shortName: "Abrufen",
    summary: "Wissen ohne Unterlagen aus dem Gedächtnis holen und erst danach kontrollieren.",
    bestFor: "Begriffe, Zusammenhänge, Sprachen und mündliche Prüfungen",
    cadence: "35–50 Minuten · kurze Selbsttests",
    evidence: "Abrufübungen verbessern langfristiges Behalten stärker als bloßes erneutes Lesen.",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/16507066/",
  },
  {
    id: "spaced-repetition",
    name: "Spaced Repetition",
    shortName: "Verteilen",
    summary: "Kurze Wiederholungen über mehrere Tage verteilen, statt alles am Stück zu lernen.",
    bestFor: "Große Stoffmengen und Prüfungen mit mehr Vorlauf",
    cadence: "Wachsende Abstände · mehrere kurze Wiederholungen",
    evidence: "Eine Metaanalyse über 317 Experimente zeigt robuste Vorteile verteilter Übung.",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/16719566/",
  },
  {
    id: "interleaving",
    name: "Interleaving",
    shortName: "Mischen",
    summary: "Ähnliche Themen und Aufgabentypen bewusst abwechseln, um die richtige Strategie zu erkennen.",
    bestFor: "Mathematik, Physik und Fächer mit ähnlichen Aufgabentypen",
    cadence: "40–50 Minuten · mehrere Themen pro Lernfolge",
    evidence: "Experimente zeigen Vorteile gegenüber geblocktem Üben, besonders beim Unterscheiden von Problemtypen.",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/30877483/",
  },
  {
    id: "pomodoro",
    name: "Pomodoro",
    shortName: "Fokus",
    summary: "Feste kurze Fokusblöcke senken die Einstiegshürde und machen Pausen verbindlich.",
    bestFor: "Aufschieben, niedrige Energie und kurze verfügbare Zeitfenster",
    cadence: "25 Minuten Fokus · 5 Minuten Pause",
    evidence: "Systematische Pausen können Konzentration und Stimmung stützen; ein genereller Lernvorteil ist nicht eindeutig.",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/36859717/",
  },
  {
    id: "exam-simulation",
    name: "Prüfungssimulation",
    shortName: "Simulieren",
    summary: "Aufgaben ohne Hilfe, unter Zeitdruck und möglichst im späteren Prüfungsformat bearbeiten.",
    bestFor: "Klausuren, große Tests und die letzten Tage vor der Prüfung",
    cadence: "40–60 Minuten · Auswertung direkt danach",
    evidence: "Der Testing Effect stärkt den späteren Abruf und deckt Wissenslücken zuverlässig auf.",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/26151629/",
  },
];

export function recommendLearningMethod(exam: Exam): Exclude<LearningMethodId, "auto"> {
  const subject = exam.subject.toLowerCase();
  const averageConfidence = exam.topics.length
    ? exam.topics.reduce((sum, topic) => sum + (topic.confidence ?? 2.5), 0) / exam.topics.length
    : 2.5;
  if (exam.type === "oral" || /geschichte|biologie|deutsch|sprache|englisch|franz|spanisch/.test(subject)) return "active-recall";
  if ((exam.size === "large" || exam.size === "very-large") && exam.topics.length >= 4) return "spaced-repetition";
  if (/mathe|physik|chemie|informatik|statistik/.test(subject) && exam.topics.length >= 2) return "interleaving";
  if (averageConfidence >= 3.8 || exam.type === "exam") return "exam-simulation";
  return "active-recall";
}

export function resolvedLearningMethod(exam: Exam) {
  return exam.learningMethod === "auto" ? recommendLearningMethod(exam) : exam.learningMethod;
}
