const USERNAME_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N}._-]{1,22}[\p{L}\p{N}])?$/u;

export function normalizeUsername(username: string): string {
  return username.trim().normalize("NFKC").toLowerCase();
}

export function validateUsername(username: string): string {
  const normalized = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new Error("Der Benutzername muss 3–24 Zeichen lang sein, mit einem Buchstaben oder einer Zahl beginnen und enden und darf Punkt, _ oder - enthalten.");
  }
  return normalized;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function usernameToAuthEmail(username: string): Promise<string> {
  const normalized = validateUsername(username);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return `u-${toHex(digest)}@accounts.fokusplan.app`;
}
