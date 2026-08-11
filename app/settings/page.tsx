"use client";

import Link from "next/link";
import { Database, LogOut, Moon, RefreshCcw, Save, ShieldCheck, Sun, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/components/providers/study-provider";
import { useAccount } from "@/components/providers/account-provider";

export default function SettingsPage() {
  const { preferences, savePreferences, resetDemo, syncStatus } = useStudy();
  const { account, signOut, updateName } = useAccount();
  const router = useRouter();
  const [draft, setDraft] = useState(preferences);
  async function save() { savePreferences(draft); await updateName(draft.name); }
  async function logout() { await signOut(); router.replace("/login"); }
  return <>
    <PageHeading eyebrow="Einstellungen" title="So passt Fokusplan zu dir" description="Konto, Lernrhythmus und Darstellung an einem ruhigen Ort." actions={<Button onClick={save}><Save size={16} />Speichern</Button>} />
    <div className="settings-layout">
      <section className="settings-card account-settings-card"><div className="settings-card-icon"><UserRound size={20} /></div><div><h2>Dein Konto</h2><p>@{account?.username}</p></div><label>Anzeigename<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><button className="signout-button" onClick={logout}><LogOut size={15} />Auf diesem Gerät abmelden</button></section>
      <section className="settings-card"><h2>Tagesbelastung</h2><p>Eine Obergrenze schützt vor unrealistischen Plänen.</p><label>Maximale aktive Lernzeit <strong>{Math.round(draft.maxDailyMinutes / 60 * 10) / 10} h</strong><input className="range" type="range" min="60" max="300" step="30" value={draft.maxDailyMinutes} onChange={(event) => setDraft({ ...draft, maxDailyMinutes: Number(event.target.value) })} /></label><label>Freier Zeitpuffer <strong>{Math.round(draft.bufferPercent * 100)} %</strong><input className="range" type="range" min="0" max="0.3" step="0.05" value={draft.bufferPercent} onChange={(event) => setDraft({ ...draft, bufferPercent: Number(event.target.value) })} /></label></section>
      <section className="settings-card"><h2>Darstellung</h2><p>Der dunkle Modus ist architektonisch vorbereitet.</p><div className="theme-options"><button className={draft.theme === "light" ? "active" : ""} onClick={() => setDraft({ ...draft, theme: "light" })}><Sun size={18} />Hell</button><button className={draft.theme === "system" ? "active" : ""} onClick={() => setDraft({ ...draft, theme: "system" })}><Moon size={18} />System</button></div></section>
      <section className="settings-card data-card"><div className="data-icon"><ShieldCheck size={22} /></div><div><h2>Sicher in der Cloud</h2><p>Anmeldung, Prüfungen und Fortschritt werden mit deinem Supabase-Konto synchronisiert. Eine lokale Kopie hält den Plan auch bei kurzen Verbindungsproblemen verfügbar.</p><span><Database size={15} />{syncStatus === "syncing" ? "Wird synchronisiert …" : syncStatus === "error" ? "Lokale Sicherung aktiv – Verbindung prüfen" : "Mit Supabase synchronisiert"}</span></div></section>
      <section className="settings-card"><h2>Demo & Ersteinrichtung</h2><p>Setze die Beispieldaten zurück oder öffne die Einrichtung erneut.</p><div className="settings-actions"><Button variant="secondary" onClick={resetDemo}><RefreshCcw size={16} />Demo zurücksetzen</Button><Link className="button button-ghost" href="/onboarding">Onboarding öffnen</Link></div></section>
    </div>
  </>;
}
