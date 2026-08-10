import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { PublicAccount, SignUpResult } from "@/types/account";

function toPublicAccount(user: User): PublicAccount {
  const email = user.email ?? "";
  const fallbackName = email.split("@")[0] || "Lernende Person";
  return {
    id: user.id,
    name: typeof user.user_metadata.name === "string" && user.user_metadata.name.trim()
      ? user.user_metadata.name.trim()
      : fallbackName,
    email,
    createdAt: user.created_at,
  };
}

function friendlyAuthError(message: string): Error {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return new Error("E-Mail oder Passwort ist nicht korrekt.");
  if (normalized.includes("user already registered")) return new Error("Für diese E-Mail gibt es bereits ein Konto.");
  if (normalized.includes("password should be")) return new Error("Das Passwort erfüllt die Sicherheitsanforderungen nicht.");
  if (normalized.includes("email rate limit")) return new Error("Zu viele E-Mails wurden angefordert. Bitte versuche es später erneut.");
  return new Error("Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.");
}

export class SupabaseAccountRepository {
  private readonly client = createClient();

  async getCurrent(): Promise<PublicAccount | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) return null;
    return toPublicAccount(data.user);
  }

  onAuthStateChange(callback: (account: PublicAccount | null, event: AuthChangeEvent) => void) {
    const { data } = this.client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      callback(session?.user ? toPublicAccount(session.user) : null, event);
    });
    return () => data.subscription.unsubscribe();
  }

  async signUp(name: string, email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await this.client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { name: name.trim() } },
    });
    if (error) throw friendlyAuthError(error.message);
    return {
      account: data.session && data.user ? toPublicAccount(data.user) : null,
      confirmationRequired: !data.session,
    };
  }

  async signIn(email: string, password: string): Promise<PublicAccount> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) throw friendlyAuthError(error?.message ?? "invalid login credentials");
    return toPublicAccount(data.user);
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw friendlyAuthError(error.message);
  }

  async updateName(name: string): Promise<PublicAccount> {
    const { data, error } = await this.client.auth.updateUser({ data: { name: name.trim() } });
    if (error || !data.user) throw friendlyAuthError(error?.message ?? "update failed");
    return toPublicAccount(data.user);
  }
}
