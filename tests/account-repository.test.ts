import { beforeEach, describe, expect, it } from "vitest";
import { usernameToAuthEmail, validateUsername } from "@/lib/auth/username";
import { LocalAccountRepository } from "@/lib/storage/account-repository";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, "window", { value: { localStorage: storage }, configurable: true });

describe("username accounts", () => {
  beforeEach(() => storage.clear());

  it("creates an account without exposing password data", async () => {
    const repository = new LocalAccountRepository();
    const account = await repository.signUp("Mia_21", "sicheres-passwort");
    expect(account.username).toBe("mia_21");
    expect(account).not.toHaveProperty("passwordHash");
    expect(repository.getActive()?.id).toBe(account.id);
  });

  it("signs in case-insensitively and rejects a wrong password", async () => {
    const repository = new LocalAccountRepository();
    await repository.signUp("Mia_21", "sicheres-passwort");
    repository.signOut();
    expect(repository.getActive()).toBeNull();
    await expect(repository.signIn("mia_21", "falsch")).rejects.toThrow();
    await expect(repository.signIn("MIA_21", "sicheres-passwort")).resolves.toMatchObject({ name: "Mia_21" });
  });

  it("keeps usernames unique after normalization", async () => {
    const repository = new LocalAccountRepository();
    await repository.signUp("Mia_21", "sicheres-passwort");
    await expect(repository.signUp("MIA_21", "noch-sicherer")).rejects.toThrow("bereits vergeben");
  });

  it("validates usernames and maps them to a stable internal identifier", async () => {
    expect(validateUsername("  Jörg.24  ")).toBe("jörg.24");
    await expect(usernameToAuthEmail("Jörg.24")).resolves.toMatch(/^u-[a-f0-9]{64}@accounts\.fokusplan\.app$/);
    await expect(usernameToAuthEmail("jörg.24")).resolves.toBe(await usernameToAuthEmail("Jörg.24"));
    expect(() => validateUsername("ab")).toThrow("3–24 Zeichen");
    expect(() => validateUsername("-mia-")).toThrow("3–24 Zeichen");
  });
});
