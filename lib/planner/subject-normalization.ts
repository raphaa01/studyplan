const aliases: Record<string, string> = {
  mathe: "mathematik",
  math: "mathematik",
  english: "englisch",
  bio: "biologie",
  geographie: "geografie",
  erdkunde: "geografie",
};

export function normalizeSubject(value: string): string {
  const normalized = value
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return aliases[normalized] ?? (normalized || "unbekannt");
}

export function stableSubjectId(subjectId: string | undefined, subject: string): string {
  return subjectId?.trim() ? normalizeSubject(subjectId) : normalizeSubject(subject);
}
