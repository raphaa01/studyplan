"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/providers/account-provider";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSubmitting(true);
    try { await signIn(email, password); router.replace("/"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Anmeldung fehlgeschlagen."); setSubmitting(false); }
  }
  return <AuthFrame mode="login"><form className="auth-form" onSubmit={submit}>
    <label>E-Mail<div className="input-with-icon"><Mail size={17} /><input required autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="du@beispiel.de" autoComplete="email" /></div></label>
    <label>Passwort<div className="input-with-icon"><LockKeyhole size={17} /><input required type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Dein Passwort" autoComplete="current-password" /><button type="button" aria-label={visible ? "Passwort ausblenden" : "Passwort anzeigen"} onClick={() => setVisible((value) => !value)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
    {error && <p className="form-error">{error}</p>}
    <Button type="submit" disabled={submitting}>{submitting ? "Wird angemeldet …" : <>Anmelden <ArrowRight size={17} /></>}</Button>
  </form><p className="auth-switch">Noch kein Konto? <Link href="/signup">Jetzt starten</Link></p></AuthFrame>;
}
