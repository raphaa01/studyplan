"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/components/providers/study-provider";
import { dayNames } from "@/lib/format";
import type { AvailabilityDay } from "@/types/study";

export default function AvailabilityPage() {
  const { availability, saveAvailability } = useStudy();
  const [draft, setDraft] = useState<AvailabilityDay[]>(availability);
  const [saved, setSaved] = useState(false);
  const updateDay = (day: number, updater: (value: AvailabilityDay) => AvailabilityDay) => setDraft((current) => current.map((item) => item.day === day ? updater(item) : item));
  function save() { saveAvailability(draft); setSaved(true); window.setTimeout(() => setSaved(false), 1800); }
  return <>
    <PageHeading eyebrow="Lernzeiten" title="Wann passt Lernen wirklich?" description="Plane realistische Zeitfenster. Fokusplan nutzt bewusst nicht jede freie Minute." actions={<Button onClick={save}><Save size={16} />{saved ? "Gespeichert" : "Änderungen speichern"}</Button>} />
    <div className="availability-layout">
      <section className="availability-list">
        {[1, 2, 3, 4, 5, 6, 0].map((dayNumber) => {
          const day = draft.find((item) => item.day === dayNumber)!;
          return <article className={`availability-day ${day.enabled ? "" : "disabled"}`} key={day.day}>
            <div className="day-toggle"><button type="button" className={`switch ${day.enabled ? "on" : ""}`} aria-label={`${dayNames[day.day]} ${day.enabled ? "deaktivieren" : "aktivieren"}`} onClick={() => updateDay(day.day, (value) => ({ ...value, enabled: !value.enabled }))}><span /></button><div><h2>{dayNames[day.day]}</h2><p>{day.enabled ? `${day.windows.length} ${day.windows.length === 1 ? "Zeitfenster" : "Zeitfenster"}` : "Lernfreier Tag"}</p></div></div>
            {day.enabled && <div className="time-windows">{day.windows.map((window) => <div className="time-window" key={window.id}><input type="time" value={window.start} onChange={(event) => updateDay(day.day, (value) => ({ ...value, windows: value.windows.map((item) => item.id === window.id ? { ...item, start: event.target.value } : item) }))} /><span>bis</span><input type="time" value={window.end} onChange={(event) => updateDay(day.day, (value) => ({ ...value, windows: value.windows.map((item) => item.id === window.id ? { ...item, end: event.target.value } : item) }))} /><button type="button" aria-label="Zeitfenster löschen" onClick={() => updateDay(day.day, (value) => ({ ...value, windows: value.windows.filter((item) => item.id !== window.id) }))}><Trash2 size={16} /></button></div>)}<button className="add-window" type="button" onClick={() => updateDay(day.day, (value) => ({ ...value, windows: [...value.windows, { id: `${day.day}-${Date.now()}`, start: "16:00", end: "17:00" }] }))}><Plus size={16} />Zeitfenster</button></div>}
          </article>;
        })}
      </section>
      <aside className="availability-help"><h2>Gute Planung braucht Luft.</h2><p>Fokusplan belegt standardmäßig höchstens 85 % deiner verfügbaren Zeit. So bleiben Übergänge und Unvorhergesehenes realistisch.</p><ul><li><strong>25–55 Minuten</strong><span>pro konzentriertem Block</span></li><li><strong>5–10 Minuten</strong><span>Pause zwischen Einheiten</span></li><li><strong>max. 3 Stunden</strong><span>aktive Lernzeit pro Tag</span></li></ul></aside>
    </div>
  </>;
}
