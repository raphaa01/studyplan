import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { normalizeUsername, usernameToAuthEmail, validateUsername } from "@/lib/auth/username";
import { createClient } from "@/lib/supabase/client";
import type { PublicAccount } from "@/types/account";

function toPublicAccount(user: User): PublicAccount {
  const username = typeof user.user_metadata.username === "string"
    ? normalizeUsername(user.user_metadata.username)
    : "lernende-person";
  return {
    id: user.id,
    name: typeof user.user_metadata.name === "string" && user.user_metadata.name.trim()
      ? user.user_metadata.name.trim()
      : username,
    username,
    createdAt: user.created_at,
  };
}

function friendlyAuthError(message: string): Error {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return new Error("Benutzername oder Passwort ist nicht korrekt.");
  if (normalized.includes("already") || normalized.includes("registered")) return new Error("Dieser Benutzername ist bereits vergeben.");
  if (normalized.includes("password")) return new Error("Das Passwort erfüllt die Sicherheitsanforderungen nicht.");
  if (normalized.includes("rate") || normalized.includes("too many")) return new Error("Zu viele Registrierungsversuche. Bitte versuche es später erneut.");
  return new Error("Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.");
}

async function functionErrorMessage(error: unknown): Promise<string> {
  if (!error || typeof error !== "object" || !("context" in error)) return String(error);
  const context = (error as { context?: Response }).context;
  if (!context) return String(error);
  try {
    const body = await context.clone().json() as { error?: string };
    return body.error ?? String(error);
  } catch {
    return String(error);
  }
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

  async signUp(username: string, password: string): Promise<PublicAccount> {
    const normalizedUsername = validateUsername(username);
    const { error: signUpError } = await this.client.functions.invoke("username-signup", {
      body: { username: normalizedUsername, password },
    });
    if (signUpError) throw friendlyAuthError(await functionErrorMessage(signUpError));
    return this.signIn(normalizedUsername, password);
  }

  async signIn(username: string, password: string): Promise<PublicAccount> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: await usernameToAuthEmail(username),
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
