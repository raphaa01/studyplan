"use client";

import { FormEvent, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import type { CalendarItem, CalendarItemKind } from "@/types/study";
import { useStudy } from "./providers/study-provider";
import { Button } from "./ui/button";

export function CalendarItemForm({ open, defaultDate, onClose }: { open: boolean; defaultDate: string; onClose: () => void }) {
  const { saveCalendarItem } = useStudy();
  const [kind, setKind] = useState<CalendarItemKind>("appointment");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("16:00");
  const [duration, setDuration] = useState(45);
  const [notes, setNotes] = useState("");

  if (!open) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const item: CalendarItem = {
      id: `calendar-${Date.now()}`,
      title: title.trim(), date, startTime, duration, kind, status: "planned", notes: notes.trim() || undefined,
    };
    saveCalendarItem(item);
    setTitle(""); setNotes(""); onClose();
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <form className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-item-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <div className="calendar-modal-head"><div className="modal-icon"><CalendarPlus size={20} /></div><button type="button" aria-label="Schließen" onClick={onClose}><X size={19} /></button></div>
      <h2 id="calendar-item-title">Zeit blocken</h2><p>Der Lernplan weicht diesem Eintrag automatisch aus.</p>
      <div className="segmented calendar-kind">{(["appointment", "todo"] as const).map((value) => <button type="button" key={value} className={kind === value ? "active" : ""} onClick={() => setKind(value)}>{value === "appointment" ? "Termin" : "To-do"}</button>)}</div>
      <label>Titel<input required autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "appointment" ? "z. B. Training" : "z. B. Referat fertigstellen"} /></label>
      <div className="form-grid three"><label>Datum<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Beginn<input required type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label>Dauer<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value="15">15 min</option><option value="25">25 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 h</option><option value="90">1,5 h</option><option value="120">2 h</option><option value="180">3 h</option></select></label></div>
      <label>Notiz <span>optional</span><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ort oder kurzer Hinweis" /></label>
      <div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Abbrechen</Button><Button type="submit">Eintragen & neu planen</Button></div>
    </form>
  </div>;
}
