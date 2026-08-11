import { createClient } from "npm:@supabase/supabase-js@2.112.2";
import { corsHeaders } from "npm:@supabase/supabase-js@2.112.2/cors";

const USERNAME_PATTERN = /^[\p{L}\p{N}](?:[\p{L}\p{N}._-]{1,22}[\p{L}\p{N}])?$/u;
const ALLOWED_ORIGINS = new Set([
  "https://fokusplan.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const VERCEL_PREVIEW_ORIGIN = /^https:\/\/fokusplan-[a-z0-9-]+-raphas-projects-f9670569\.vercel\.app$/;

function normalizeUsername(username: string): string {
  return username.trim().normalize("NFKC").toLowerCase();
}

function isAllowedOrigin(origin: string | null): boolean {
  return origin === null || ALLOWED_ORIGINS.has(origin) || VERCEL_PREVIEW_ORIGIN.test(origin);
}

function responseHeaders(origin: string | null): Record<string, string> {
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": origin ?? "*",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function jsonResponse(origin: string | null, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: "Origin nicht erlaubt." }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Vary": "Origin" },
    });
  }
  if (request.method === "OPTIONS") return new Response("ok", { headers: responseHeaders(origin) });
  if (request.method !== "POST") return jsonResponse(origin, 405, { error: "Methode nicht erlaubt." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse(origin, 500, { error: "Serverkonfiguration fehlt." });

  let payload: { username?: unknown; password?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(origin, 400, { error: "Ungültige Anfrage." });
  }

  if (typeof payload.username !== "string" || typeof payload.password !== "string") {
    return jsonResponse(origin, 400, { error: "Benutzername und Passwort sind erforderlich." });
  }

  const username = normalizeUsername(payload.username);
  if (!USERNAME_PATTERN.test(username)) {
    return jsonResponse(origin, 400, { error: "Der Benutzername muss 3–24 Zeichen lang sein, mit einem Buchstaben oder einer Zahl beginnen und enden und darf Punkt, _ oder - enthalten." });
  }
  if (payload.password.length < 8 || payload.password.length > 72) {
    return jsonResponse(origin, 400, { error: "Das Passwort muss 8–72 Zeichen lang sein." });
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientAddress = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? forwardedFor ?? "unknown";
  const rateKey = await sha256(`${clientAddress}:${serviceRoleKey.slice(-24)}`);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: allowed, error: rateLimitError } = await admin.rpc("consume_username_signup_attempt", { p_rate_key: rateKey });
  if (rateLimitError) return jsonResponse(origin, 500, { error: "Registrierung ist momentan nicht verfügbar." });
  if (!allowed) return jsonResponse(origin, 429, { error: "Zu viele Registrierungsversuche. Bitte versuche es später erneut." });

  const internalEmail = `u-${await sha256(username)}@accounts.fokusplan.app`;
  const { error: createError } = await admin.auth.admin.createUser({
    email: internalEmail,
    password: payload.password,
    email_confirm: true,
    user_metadata: { username, name: username },
  });

  if (createError) {
    const duplicate = createError.message.toLowerCase().includes("already") || createError.message.toLowerCase().includes("registered");
    return jsonResponse(origin, duplicate ? 409 : 400, {
      error: duplicate ? "Dieser Benutzername ist bereits vergeben." : "Das Konto konnte nicht erstellt werden.",
    });
  }

  return jsonResponse(origin, 201, { username });
});
