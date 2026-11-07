// Small helpers shared by all API functions.
import { readSession, sessionCookie } from "./session.ts";
import type { SessionState } from "./session.ts";

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

/** Runs `handler` for a signed-in visitor, or answers 401. Saves the session if the handler changed it. */
export async function withSession(
  req: Request,
  handler: (state: SessionState) => Promise<Response> | Response,
): Promise<Response> {
  const state = await readSession(req);
  if (!state) return error(401, "unauthorized", "Sign in first.");
  const before = JSON.stringify(state);
  const res = await handler(state);
  if (JSON.stringify(state) !== before) res.headers.append("set-cookie", await sessionCookie(state, req));
  return res;
}
