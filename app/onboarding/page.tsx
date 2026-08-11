"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Clock3, GraduationCap, MoonStar, SunMedium, TimerReset } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStudy } from "@/components/providers/study-provider";
import { useAccount } from "@/components/providers/account-provider";
import { dayNames } from "@/lib/format";

const loadOptions = [
  { minutes: 90, title: "Leicht", text: "Bis 1,5 Stunden pro Tag" },
  { minutes: 150, title: "Ausgeglichen", text: "Bis 2,5 Stunden pro Tag" },
  { minutes: 210, title: "Intensiv", text: "Bis 3,5 Stunden pro Tag" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { account } = useAccount();
  const { availability, preferences, saveAvailability, savePreferences } = useStudy();
  const [step, setStep] = useState(1);
  const [maxDailyMinutes, setMaxDailyMinutes] = useState(preferences.maxDailyMinutes || 150);
  const [days, setDays] = useState(availability);
  const [timePreset, setTimePreset] = useState<"afternoon" | "evening" | "mixed">("afternoon");
  const toggle = (day: number) => setDays((current) => current.map((item) => item.day === day ? { ...item, enabled: !item.enabled } : item));
  function finish() {
    const windows = timePreset === "evening" ? [{ start: "18:00", end: "20:00" }] : timePreset === "mixed" ? [{ start: "16:00", end: "17:15" }, { start: "19:00", end: "20:00" }] : [{ start: "16:00", end: "18:00" }];
    const nextDays = days.map((day) => day.enabled ? { ...day, windows: windows.map((window, index) => ({ id: `${day.day}-${index}`, ...window })) } : day);
    saveAvailability(nextDays);
    savePreferences({ ...preferences, name: account?.name ?? preferences.name, maxDailyMinutes, bufferPercent: 0.15, onboardingCompleted: true });
    router.replace("/");
  }
  return <main className="onboarding-shell setup-shell">
    <header className="onboarding-header"><div className="brand"><span className="brand-mark"><GraduationCap size={20} /></span><span>Fokusplan</span></div><span>@{account?.username}</span></header>
    <div className="onboarding-progress"><span style={{ width: `${step / 3 * 100}%` }} /></div>
    <section className="onboarding-card setup-card">
      {step === 1 && <div className="onboarding-content wide"><span className="setup-step">01</span><p className="eyebrow">Dein Rhythmus</p><h1>Wie viel soll an einem Tag maximal anstehen?</h1><p className="lead">Das ist eine Obergrenze, kein tägliches Ziel. Fokusplan lässt bewusst Luft für Schule, Freizeit und Erholung.</p><div className="load-options">{loadOptions.map((option) => <button key={option.minutes} className={maxDailyMinutes === option.minutes ? "active" : ""} onClick={() => setMaxDailyMinutes(option.minutes)}><TimerReset size={20} /><strong>{option.title}</strong><span>{option.text}</span>{maxDailyMinutes === option.minutes && <i><Check size={14} /></i>}</button>)}</div></div>}
      {step === 2 && <div className="onboarding-content wide"><span className="setup-step">02</span><p className="eyebrow">Deine Woche</p><h1>An welchen Tagen passt Lernen meistens?</h1><p className="lead">Wähle realistische Tage. Einzelne Ausnahmen kannst du später jederzeit im Lernplan ändern.</p><div className="onboarding-days">{[1, 2, 3, 4, 5, 6, 0].map((day) => { const active = days.find((item) => item.day === day)?.enabled; return <button key={day} className={active ? "active" : ""} onClick={() => toggle(day)}><span>{dayNames[day].slice(0, 2)}</span><strong>{dayNames[day]}</strong>{active && <Check size={17} />}</button>; })}</div></div>}
      {step === 3 && <div className="onboarding-content wide"><span className="setup-step">03</span><p className="eyebrow">Deine Zeit</p><h1>Wann kannst du dich am besten konzentrieren?</h1><p className="lead">Wir legen passende Startwerte an. Die genauen Zeitfenster kannst du später pro Wochentag anpassen.</p><div className="time-presets"><button className={timePreset === "afternoon" ? "active" : ""} onClick={() => setTimePreset("afternoon")}><SunMedium size={22} /><span><strong>Nachmittags</strong><small>16:00–18:00 Uhr</small></span><i>{timePreset === "afternoon" && <Check size={14} />}</i></button><button className={timePreset === "evening" ? "active" : ""} onClick={() => setTimePreset("evening")}><MoonStar size={22} /><span><strong>Abends</strong><small>18:00–20:00 Uhr</small></span><i>{timePreset === "evening" && <Check size={14} />}</i></button><button className={timePreset === "mixed" ? "active" : ""} onClick={() => setTimePreset("mixed")}><Clock3 size={22} /><span><strong>Flexibel</strong><small>Zwei kürzere Fenster</small></span><i>{timePreset === "mixed" && <Check size={14} />}</i></button></div></div>}
      <footer className="onboarding-actions">{step > 1 ? <Button variant="ghost" onClick={() => setStep((value) => value - 1)}><ArrowLeft size={17} />Zurück</Button> : <span />}{step < 3 ? <Button onClick={() => setStep((value) => value + 1)}>Weiter <ArrowRight size={17} /></Button> : <Button onClick={finish}>Fokusplan öffnen <ArrowRight size={17} /></Button>}</footer>
    </section>
  </main>;
}
