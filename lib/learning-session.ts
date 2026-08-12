import type { Exam, ExamTopic, LearningSessionProgress, StudySession } from "@/types/study";

export interface LearningPrompt {
  id: string;
  prompt: string;
  cue: string;
}

export interface LearningCard {
  id: string;
  front: string;
  back: string;
}

export interface LearningSessionContent {
  tasks: Array<{ id: string; text: string }>;
  recall: LearningPrompt[];
  cards: LearningCard[];
}

const quantitative = /mathe|physik|chemie|informatik|statistik|rechnung/i;
const language = /deutsch|englisch|franz|spanisch|latein|sprache/i;

export function createLearningSessionContent(session: StudySession, exam: Exam, topic: ExamTopic): LearningSessionContent {
  const topicName = topic.name;
  const tasks = quantitative.test(exam.subject)
    ? [session.description, `Schreibe die wichtigsten Regeln oder Formeln zu ${topicName} aus dem Gedächtnis auf.`, `Löse mindestens eine Aufgabe vollständig ohne Hilfe und erkläre anschließend jeden Rechenschritt.`, "Markiere Fehler und notiere die Regel, die du beim nächsten Mal früher erkennen willst."]
    : language.test(exam.subject)
      ? [session.description, `Rufe zentrale Wörter, Regeln oder Textbausteine zu ${topicName} ohne Vorlage ab.`, "Formuliere ein eigenes Beispiel und verbessere es anschließend mit deinen Unterlagen.", "Notiere zwei typische Fehler und jeweils eine bessere Formulierung."]
      : [session.description, `Erkläre ${topicName} zwei Minuten lang laut und ohne Unterlagen.`, "Zeichne die wichtigsten Zusammenhänge als kleine Skizze oder Ablaufkette.", "Prüfe erst danach deine Notizen und ergänze nur die erkannten Lücken."];

  return {
    tasks: tasks.map((text, index) => ({ id: `task-${index + 1}`, text })),
    recall: [
      { id: "recall-1", prompt: `Was ist die Kernidee von ${topicName}?`, cue: "Nenne Definition, Zweck und ein konkretes Beispiel – erst dann in den Unterlagen prüfen." },
      { id: "recall-2", prompt: `Woran erkennst du eine typische Prüfungsaufgabe zu ${topicName}?`, cue: "Achte auf Schlüsselbegriffe, gegebene Informationen und die geforderte Denkoperation." },
      { id: "recall-3", prompt: `Welche Verwechslung oder welcher Fehler ist bei ${topicName} besonders wahrscheinlich?`, cue: "Formuliere eine Warnregel, die du dir unmittelbar vor der Prüfung sagen kannst." },
    ],
    cards: [
      { id: "card-1", front: `${topicName}: Kernidee`, back: "Erkläre sie in höchstens zwei Sätzen und ergänze ein Beispiel." },
      { id: "card-2", front: `${topicName}: Vorgehen`, back: "Nenne die Schritte in der richtigen Reihenfolge – ohne eine Lücke zu überspringen." },
      { id: "card-3", front: `${topicName}: Fehlercheck`, back: "Nenne den häufigsten Fehler und wie du ihn zuverlässig bemerkst." },
    ],
  };
}

export function createLearningProgress(session: StudySession, now = new Date()): LearningSessionProgress {
  return { sessionId: session.id, remainingSeconds: session.duration * 60, runningSince: null, stage: 0, checkedTaskIds: [], revealedRecallIds: [], reflection: "", updatedAt: now.toISOString() };
}

export function remainingLearningSeconds(progress: LearningSessionProgress, nowMs = Date.now()): number {
  if (!progress.runningSince) return Math.max(0, progress.remainingSeconds);
  const elapsed = Math.max(0, Math.floor((nowMs - new Date(progress.runningSince).getTime()) / 1000));
  return Math.max(0, progress.remainingSeconds - elapsed);
}
