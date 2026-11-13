// Per-visitor demo data lives in a signed cookie, so every visitor gets their own copy of the team
// and nothing is stored on the server. The cookie holds only what changed from the seed.
import type { Shift } from "./seed.ts";

export type Decision = "approved" | "denied";
export type SessionState = {
  v: 1;
  user: string;
  /** Session id: the row key in the database when DATABASE_URL is set. */
  sid: string;
  added: Shift[];
  decisions: Record<string, Decision>;
};

export const SESSION_COOKIE = "rostr_session";
const MAX_ADDED_SHIFTS = 20;

function secret(): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.ROSTR_SESSION_SECRET || "rostr-local-dev-secret";
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(new Uint8Array(sig));
}

export function newSession(user: string): SessionState {
  return { v: 1, user, sid: crypto.randomUUID(), added: [], decisions: {} };
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

export async function readSession(req: Request): Promise<SessionState | null> {
  const raw = readCookie(req, SESSION_COOKIE);
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || (await hmac(payload)) !== sig) return null;
  try {
    const state = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (state?.v !== 1) return null;
    state.sid ??= crypto.randomUUID(); // cookies issued before the database existed have no id
    return state as SessionState;
  } catch {
    return null;
  }
}

function cookieAttrs(req: Request): string {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export async function sessionCookie(state: SessionState, req: Request): Promise<string> {
  state.added = state.added.slice(-MAX_ADDED_SHIFTS);
  const payload = b64url(new TextEncoder().encode(JSON.stringify(state)));
  return `${SESSION_COOKIE}=${payload}.${await hmac(payload)}; ${cookieAttrs(req)}; Max-Age=86400`;
}

export function clearSessionCookie(req: Request): string {
  return `${SESSION_COOKIE}=; ${cookieAttrs(req)}; Max-Age=0`;
}
