import type { Exam, ExamTopic, SessionType } from "@/types/study";

const quantitative = /mathe|physik|chemie|informatik|statistik|rechnung/i;
const language = /deutsch|englisch|franz|spanisch|latein|sprache/i;

const phaseLabel: Record<Exclude<SessionType, "break">, string> = {
  understand: "Verstehen",
  practice: "Üben",
  recall: "Aktiv abrufen",
  simulation: "Mini-Prüfung",
  review: "Leicht festigen",
};

export function sessionCopy(exam: Exam, topic: ExamTopic, type: Exclude<SessionType, "break">, duration: number) {
  let description: string;
  if (quantitative.test(exam.subject)) {
    const tasks = Math.max(3, Math.round(duration / 9));
    description = type === "understand"
      ? `Grundidee kurz klären, dann ${tasks} Aufgaben mit abnehmender Hilfestellung lösen.`
      : type === "simulation"
        ? `${tasks} gemischte Aufgaben ohne Hilfe unter Zeitdruck lösen und Fehler markieren.`
        : `${tasks} gemischte Aufgaben ohne Lösungshilfe bearbeiten und Fehler erklären.`;
  } else if (language.test(exam.subject)) {
    description = type === "simulation"
      ? `Kurze Prüfungsaufgabe unter Zeitlimit bearbeiten und anschließend selbst korrigieren.`
      : `Begriffe aktiv abrufen, einen kurzen Text formulieren und typische Fehler korrigieren.`;
  } else {
    description = type === "understand"
      ? `Zusammenhänge in eigenen Worten erklären, danach Notizen gezielt auf Lücken prüfen.`
      : type === "simulation"
        ? `Prüfungsfragen ohne Unterlagen beantworten und Antworten mit Notizen korrigieren.`
        : `Stoff aus dem Gedächtnis erklären und ${Math.max(4, Math.round(duration / 7))} Abruffragen beantworten.`;
  }
  return { title: `${topic.name} · ${phaseLabel[type]}`, description };
}

export function rationaleFor(exam: Exam, topic: ExamTopic, daysLeft: number, type: Exclude<SessionType, "break">, repeat: number): string {
  const confidence = topic.confidence === null ? "noch nicht eingeschätzt" : `${topic.confidence}/5 eingeschätzt`;
  const spacing = repeat > 0 ? ` Es ist Wiederholung ${repeat + 1} mit zeitlichem Abstand.` : " Diese erste Einheit schafft eine belastbare Grundlage.";
  const phase = type === "simulation" ? " Eine realistische Abrufprobe nutzt den Testing Effect." : " Aktiver Abruf stärkt das langfristige Behalten.";
  return `${exam.title} ist in ${daysLeft === 1 ? "einem Tag" : `${daysLeft} Tagen`}; ${topic.name} ist ${confidence}.${spacing}${phase}`;
}
