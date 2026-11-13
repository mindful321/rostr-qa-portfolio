// Small helpers shared by all API functions.
import { readSession, sessionCookie } from "./session.ts";
import type { SessionState } from "./session.ts";
import { isDbMode, loadState, saveChanges } from "./db.ts";

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function error(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export function methodNotAllowed(allowed: string[]): Response {
  return new Response(JSON.stringify({ error: { code: "method_not_allowed", message: `Use ${allowed.join(" or ")}` } }), {
    status: 405,
    headers: { "content-type": "application/json; charset=utf-8", allow: allowed.join(", ") },
  });
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Runs `handler` for a signed-in visitor, or answers 401, then saves whatever the handler changed.
 * - Database mode (DATABASE_URL set): the cookie only identifies the session; shifts and decisions
 *   are loaded from and written to Postgres.
 * - Cookie mode (live demo): the changes travel in the signed cookie itself.
 */
export async function withSession(
  req: Request,
  handler: (state: SessionState) => Promise<Response> | Response,
): Promise<Response> {
  const state = await readSession(req);
  if (!state) return error(401, "unauthorized", "Sign in first.");

  if (isDbMode()) {
    if (!(await loadState(state))) return error(401, "unauthorized", "Session expired. Sign in again.");
    const before: SessionState = structuredClone(state);
    const res = await handler(state);
    await saveChanges(before, state);
    return res;
  }

  const before = JSON.stringify(state);
  const res = await handler(state);
  if (JSON.stringify(state) !== before) res.headers.append("set-cookie", await sessionCookie(state, req));
  return res;
}
