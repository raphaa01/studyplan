import type { AccountStore, LocalAccount, PublicAccount } from "@/types/account";

const ACCOUNT_KEY = "fokusplan:accounts:v1";
const EMPTY_STORE: AccountStore = { version: 1, accounts: [], activeAccountId: null };

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const result = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 120_000 }, key, 256);
  return toHex(result);
}

function publicAccount(account: LocalAccount): PublicAccount {
  return { id: account.id, name: account.name, email: account.email, createdAt: account.createdAt };
}

export class LocalAccountRepository {
  private read(): AccountStore {
    if (typeof window === "undefined") return EMPTY_STORE;
    try {
      const raw = window.localStorage.getItem(ACCOUNT_KEY);
      return raw ? JSON.parse(raw) as AccountStore : EMPTY_STORE;
    } catch {
      return EMPTY_STORE;
    }
  }

  private write(store: AccountStore): void {
    window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(store));
  }

  getActive(): PublicAccount | null {
    const store = this.read();
    const account = store.accounts.find((item) => item.id === store.activeAccountId);
    return account ? publicAccount(account) : null;
  }

  list(): PublicAccount[] {
    return this.read().accounts.map(publicAccount);
  }

  async signUp(name: string, email: string, password: string): Promise<PublicAccount> {
    const store = this.read();
    const normalizedEmail = email.trim().toLowerCase();
    if (store.accounts.some((account) => account.email === normalizedEmail)) throw new Error("Für diese E-Mail gibt es bereits ein Konto.");
    const salt = crypto.randomUUID();
    const account: LocalAccount = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(password, salt),
      salt,
      createdAt: new Date().toISOString(),
    };
    this.write({ version: 1, accounts: [...store.accounts, account], activeAccountId: account.id });
    return publicAccount(account);
  }

  async signIn(email: string, password: string): Promise<PublicAccount> {
    const store = this.read();
    const account = store.accounts.find((item) => item.email === email.trim().toLowerCase());
    if (!account || await hashPassword(password, account.salt) !== account.passwordHash) throw new Error("E-Mail oder Passwort ist nicht korrekt.");
    this.write({ ...store, activeAccountId: account.id });
    return publicAccount(account);
  }

  signOut(): void {
    this.write({ ...this.read(), activeAccountId: null });
  }

  updateName(id: string, name: string): PublicAccount | null {
    const store = this.read();
    const accounts = store.accounts.map((account) => account.id === id ? { ...account, name: name.trim() } : account);
    this.write({ ...store, accounts });
    const updated = accounts.find((account) => account.id === id);
    return updated ? publicAccount(updated) : null;
  }
}
