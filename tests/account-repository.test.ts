import { beforeEach, describe, expect, it } from "vitest";
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

describe("local account repository", () => {
  beforeEach(() => storage.clear());

  it("creates a local account without exposing its password data", async () => {
    const repository = new LocalAccountRepository();
    const account = await repository.signUp("Mia", "MIA@example.de", "sicheres-passwort");
    expect(account.email).toBe("mia@example.de");
    expect(account).not.toHaveProperty("passwordHash");
    expect(repository.getActive()?.id).toBe(account.id);
  });

  it("signs in only with the correct password and supports sign-out", async () => {
    const repository = new LocalAccountRepository();
    await repository.signUp("Mia", "mia@example.de", "sicheres-passwort");
    repository.signOut();
    expect(repository.getActive()).toBeNull();
    await expect(repository.signIn("mia@example.de", "falsch")).rejects.toThrow();
    await expect(repository.signIn("mia@example.de", "sicheres-passwort")).resolves.toMatchObject({ name: "Mia" });
  });

  it("keeps multiple local accounts separate", async () => {
    const repository = new LocalAccountRepository();
    await repository.signUp("Mia", "mia@example.de", "sicheres-passwort");
    await repository.signUp("Noah", "noah@example.de", "noch-sicherer");
    expect(repository.list().map((account) => account.email)).toEqual(["mia@example.de", "noah@example.de"]);
  });
});
