"use client";

import { CalendarClock, Clock3, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/components/providers/study-provider";
import { dayNames } from "@/lib/format";
import { routineCadence, routineSessionDurations } from "@/lib/routines";
import { stableSubjectId } from "@/lib/planner/subject-normalization";
import type { AvailabilityDay, LearningRoutine, RoutineFixedSlot } from "@/types/study";

const orderedDays = [1, 2, 3, 4, 5, 6, 0];

function newRoutine(): LearningRoutine {
  return {
    id: crypto.randomUUID(), subjectId: "", subject: "", title: "Regelmäßig lernen",
    weeklyMinutes: 45, schedulingMode: "ai", fixedSlots: [], sessionsPerWeek: 1,
    preferredSessionMinutes: 45, importance: 2, difficulty: 3, learningMethod: "auto",
    flexible: true, enabled: true,
  };
}

function normalizedRoutine(routine: LearningRoutine): LearningRoutine {
  const fixedCount = routine.schedulingMode === "fixed" ? routine.fixedSlots.length : 0;
  const cadence = routineCadence(routine.weeklyMinutes, fixedCount);
  return {
    ...routine,
    subject: routine.subject.trim(),
    subjectId: stableSubjectId(routine.subjectId, routine.subject),
    title: `${routine.subject.trim()} regelmäßig lernen`,
    weeklyMinutes: cadence.weeklyMinutes,
    sessionsPerWeek: cadence.sessionsPerWeek,
    preferredSessionMinutes: cadence.preferredSessionMinutes,
    flexible: routine.schedulingMode === "ai",
    fixedSlots: routine.schedulingMode === "fixed" ? routine.fixedSlots : [],
  };
}

export default function AvailabilityPage() {
  const { availability, routines, exams, saveLearningSettings } = useStudy();
  const [draft, setDraft] = useState<AvailabilityDay[]>(availability);
  const [routineDraft, setRoutineDraft] = useState<LearningRoutine[]>(routines);
  const [saved, setSaved] = useState(false);
  const subjects = [...new Set(exams.map((exam) => exam.subject).filter(Boolean))].sort();

  const updateDay = (day: number, updater: (value: AvailabilityDay) => AvailabilityDay) => {
    setDraft((current) => current.map((item) => item.day === day ? updater(item) : item));
  };
  const updateRoutine = (id: string, updater: (value: LearningRoutine) => LearningRoutine) => {
    setRoutineDraft((current) => current.map((item) => item.id === id ? updater(item) : item));
  };
  function defaultFixedSlot(existing: RoutineFixedSlot[] = []): RoutineFixedSlot {
    const candidates = orderedDays.map((day) => draft.find((item) => item.day === day))
      .filter((day): day is AvailabilityDay => Boolean(day?.enabled && day.windows.length));
    const previousIndex = existing.length ? candidates.findIndex((day) => day.day === existing.at(-1)?.day) : -1;
    const day = candidates[(previousIndex + 1) % Math.max(candidates.length, 1)] ?? draft.find((item) => item.day === 1)!;
    return { id: crypto.randomUUID(), day: day.day, startTime: day.windows[0]?.start ?? "16:00" };
  }
  function save() {
    const nextRoutines = routineDraft.filter((routine) => routine.subject.trim()).map(normalizedRoutine);
    setRoutineDraft(nextRoutines);
    saveLearningSettings(draft, nextRoutines);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return <>
    <PageHeading
      eyebrow="Lernzeiten"
      title="Deine Woche, realistisch geplant."
      description="Lege zuerst deine freien Zeitfenster fest und ergänze Fächer, die du unabhängig von Prüfungen regelmäßig lernen möchtest."
      actions={<Button onClick={save}><Save size={16} />{saved ? "Gespeichert" : "Änderungen speichern"}</Button>}
    />

    <section className="routine-section" aria-labelledby="routine-heading">
      <div className="routine-section-head">
        <div>
          <span className="eyebrow">Wöchentliche Lernziele</span>
          <h2 id="routine-heading">Regelmäßig dranbleiben</h2>
          <p>Prüfungslernen im selben Fach zählt automatisch zu diesen Minuten. So entsteht keine doppelte Belastung.</p>
        </div>
        <Button variant="secondary" onClick={() => setRoutineDraft((current) => [...current, newRoutine()])}><Plus size={15} />Fach hinzufügen</Button>
      </div>

      {routineDraft.length === 0 ? <button type="button" className="routine-empty" onClick={() => setRoutineDraft([newRoutine()])}>
        <span><Clock3 size={19} /></span>
        <strong>Erstes Wochenziel anlegen</strong>
        <small>Zum Beispiel 45 Minuten Mathematik pro Woche.</small>
      </button> : <div className="routine-list">
        {routineDraft.map((routine) => {
          const slotDurations = routineSessionDurations(routine.weeklyMinutes, Math.max(1, routine.fixedSlots.length));
          const maxSlots = Math.min(7, Math.floor(routine.weeklyMinutes / 25));
          return <article className="routine-card" key={routine.id}>
            <div className="routine-card-main">
              <label className="routine-subject-field">
                <span>Fach</span>
                <input list="routine-subjects" value={routine.subject} placeholder="z. B. Mathematik" onChange={(event) => updateRoutine(routine.id, (value) => ({ ...value, subject: event.target.value }))} />
              </label>
              <label className="routine-minutes-field">
                <span>Pro Woche</span>
                <div><input type="number" min={25} max={420} step={5} value={routine.weeklyMinutes} onChange={(event) => updateRoutine(routine.id, (value) => ({ ...value, weeklyMinutes: Number(event.target.value) }))} /><small>Min.</small></div>
              </label>
              <button type="button" className="routine-delete" aria-label={`${routine.subject || "Lernziel"} löschen`} onClick={() => setRoutineDraft((current) => current.filter((item) => item.id !== routine.id))}><Trash2 size={16} /></button>
            </div>

            <div className="routine-schedule-row">
              <span>Wann soll gelernt werden?</span>
              <div className="routine-mode" role="group" aria-label="Zeitplanung">
                <button type="button" aria-pressed={routine.schedulingMode === "ai"} className={routine.schedulingMode === "ai" ? "active" : ""} onClick={() => updateRoutine(routine.id, (value) => ({ ...value, schedulingMode: "ai", flexible: true }))}>Automatisch verteilen</button>
                <button type="button" aria-pressed={routine.schedulingMode === "fixed"} className={routine.schedulingMode === "fixed" ? "active" : ""} onClick={() => updateRoutine(routine.id, (value) => ({ ...value, schedulingMode: "fixed", flexible: false, fixedSlots: value.fixedSlots.length ? value.fixedSlots : [defaultFixedSlot()] }))}>Feste Termine</button>
              </div>
            </div>

            {routine.schedulingMode === "ai" ? <div className="routine-ai-note"><CalendarClock size={15} /><span>QECore verteilt die Minuten auf freie Zeitfenster und verschiebt sie bei wichtigeren Prüfungen.</span></div> : <div className="routine-fixed-slots">
              {routine.fixedSlots.map((slot, index) => <div className="routine-fixed-slot" key={slot.id}>
                <select aria-label="Wochentag" value={slot.day} onChange={(event) => updateRoutine(routine.id, (value) => ({ ...value, fixedSlots: value.fixedSlots.map((item) => item.id === slot.id ? { ...item, day: Number(event.target.value) } : item) }))}>
                  {orderedDays.map((day) => <option value={day} key={day}>{dayNames[day]}</option>)}
                </select>
                <input aria-label="Startzeit" type="time" value={slot.startTime} onChange={(event) => updateRoutine(routine.id, (value) => ({ ...value, fixedSlots: value.fixedSlots.map((item) => item.id === slot.id ? { ...item, startTime: event.target.value } : item) }))} />
                <span>{slotDurations[index] ?? routine.preferredSessionMinutes} Min.</span>
                <button type="button" aria-label="Termin entfernen" disabled={routine.fixedSlots.length === 1} onClick={() => updateRoutine(routine.id, (value) => ({ ...value, fixedSlots: value.fixedSlots.filter((item) => item.id !== slot.id) }))}><Trash2 size={14} /></button>
              </div>)}
              <button type="button" className="add-fixed-slot" disabled={routine.fixedSlots.length >= maxSlots} onClick={() => updateRoutine(routine.id, (value) => ({ ...value, fixedSlots: [...value.fixedSlots, defaultFixedSlot(value.fixedSlots)] }))}><Plus size={14} />Weiteren Termin</button>
              <p>Die {routine.weeklyMinutes} Minuten werden gleichmäßig auf deine {routine.fixedSlots.length === 1 ? "Einheit" : `${routine.fixedSlots.length} Einheiten`} verteilt.</p>
            </div>}
          </article>;
        })}
      </div>}
      <datalist id="routine-subjects">{subjects.map((subject) => <option value={subject} key={subject} />)}</datalist>
    </section>

    <div className="availability-layout">
      <section className="availability-list" aria-label="Allgemeine Lernfenster">
        <div className="availability-section-title"><span className="eyebrow">Freie Zeitfenster</span><h2>Wann darf geplant werden?</h2></div>
        {orderedDays.map((dayNumber) => {
          const day = draft.find((item) => item.day === dayNumber)!;
          return <article className={`availability-day ${day.enabled ? "" : "disabled"}`} key={day.day}>
            <div className="day-toggle"><button type="button" className={`switch ${day.enabled ? "on" : ""}`} aria-label={`${dayNames[day.day]} ${day.enabled ? "deaktivieren" : "aktivieren"}`} onClick={() => updateDay(day.day, (value) => ({ ...value, enabled: !value.enabled }))}><span /></button><div><h2>{dayNames[day.day]}</h2><p>{day.enabled ? `${day.windows.length} Zeitfenster` : "Lernfreier Tag"}</p></div></div>
            {day.enabled && <div className="time-windows">{day.windows.map((window) => <div className="time-window" key={window.id}><input type="time" value={window.start} onChange={(event) => updateDay(day.day, (value) => ({ ...value, windows: value.windows.map((item) => item.id === window.id ? { ...item, start: event.target.value } : item) }))} /><span>bis</span><input type="time" value={window.end} onChange={(event) => updateDay(day.day, (value) => ({ ...value, windows: value.windows.map((item) => item.id === window.id ? { ...item, end: event.target.value } : item) }))} /><button type="button" aria-label="Zeitfenster löschen" onClick={() => updateDay(day.day, (value) => ({ ...value, windows: value.windows.filter((item) => item.id !== window.id) }))}><Trash2 size={16} /></button></div>)}<button className="add-window" type="button" onClick={() => updateDay(day.day, (value) => ({ ...value, windows: [...value.windows, { id: `${day.day}-${Date.now()}`, start: "16:00", end: "17:00" }] }))}><Plus size={16} />Zeitfenster</button></div>}
          </article>;
        })}
      </section>
      <aside className="availability-help"><h2>Gute Planung braucht Luft.</h2><p>Fokusplan belegt standardmäßig höchstens 85 % deiner verfügbaren Zeit. Feste Routinen bleiben an ihrem Termin; automatische Ziele nutzen passende Lücken.</p><ul><li><strong>25–60 Minuten</strong><span>pro konzentriertem Block</span></li><li><strong>Prüfung zählt mit</strong><span>wenn das Fach übereinstimmt</span></li><li><strong>max. 3 Stunden</strong><span>aktive Lernzeit pro Tag</span></li></ul></aside>
    </div>
  </>;
}
