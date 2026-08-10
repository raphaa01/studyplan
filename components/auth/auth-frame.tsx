import Link from "next/link";
import { Check, GraduationCap } from "lucide-react";

export function AuthFrame({ mode, children }: { mode: "login" | "signup"; children: React.ReactNode }) {
  const signup = mode === "signup";
  return <main className="auth-shell">
    <section className="auth-story">
      <Link href="/" className="brand"><span className="brand-mark"><GraduationCap size={20} /></span><span>Fokusplan</span></Link>
      <div className="auth-story-copy"><p className="eyebrow">Weniger planen. Besser lernen.</p><h1>Dein nächster sinnvoller Schritt – immer klar.</h1><p>Fokusplan übersetzt Prüfungen, freie Zeit und deinen Lernstand in einen ruhigen, machbaren Wochenplan.</p><div className="auth-benefits"><span><Check size={16} />Konkrete Lernaufgaben statt vager Ziele</span><span><Check size={16} />Wiederholungen im richtigen Abstand</span><span><Check size={16} />Realistische Belastung mit echten Pausen</span></div></div>
      <p className="auth-local-note">Deine Daten bleiben in dieser Version auf diesem Gerät.</p>
    </section>
    <section className="auth-panel"><div className="auth-card"><p className="eyebrow">{signup ? "Konto erstellen" : "Willkommen zurück"}</p><h2>{signup ? "Starte mit deinem Lernplan." : "Weiterlernen, wo du aufgehört hast."}</h2><p>{signup ? "Danach richten wir deinen Plan in drei kurzen Schritten ein." : "Melde dich mit deinem lokalen Fokusplan-Konto an."}</p>{children}</div></section>
  </main>;
}
