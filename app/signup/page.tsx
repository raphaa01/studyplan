"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/providers/account-provider";

export default function SignUpPage() {
  const router = useRouter();
  const { signUp } = useAccount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("Das Passwort muss mindestens 8 Zeichen lang sein."); return; }
    setSubmitting(true);
    try {
      const result = await signUp(name, email, password);
      if (result.confirmationRequired) {
        setConfirmationEmail(email);
        setSubmitting(false);
      } else router.replace("/onboarding");
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Das Konto konnte nicht erstellt werden."); setSubmitting(false); }
  }
  if (confirmationEmail) return <AuthFrame mode="signup"><div className="auth-confirmation"><span>✓</span><h3>Bestätige deine E-Mail</h3><p>Wir haben einen Bestätigungslink an <strong>{confirmationEmail}</strong> gesendet. Danach kannst du dich anmelden und dein Lernplan wird online gespeichert.</p><Link className="button button-primary" href="/login">Zur Anmeldung</Link></div></AuthFrame>;
  return <AuthFrame mode="signup"><form className="auth-form" onSubmit={submit}>
    <label>Name<div className="input-with-icon"><UserRound size={17} /><input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Dein Vorname" /></div></label>
    <label>E-Mail<div className="input-with-icon"><Mail size={17} /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="du@beispiel.de" autoComplete="email" /></div></label>
    <label>Passwort<div className="input-with-icon"><LockKeyhole size={17} /><input required type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mindestens 8 Zeichen" autoComplete="new-password" /><button type="button" aria-label={visible ? "Passwort ausblenden" : "Passwort anzeigen"} onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
    {error && <p className="form-error">{error}</p>}
    <Button type="submit" disabled={submitting}>{submitting ? "Konto wird erstellt …" : <>Konto erstellen <ArrowRight size={17} /></>}</Button>
  </form><p className="auth-switch">Du hast schon ein Konto? <Link href="/login">Anmelden</Link></p></AuthFrame>;
}
