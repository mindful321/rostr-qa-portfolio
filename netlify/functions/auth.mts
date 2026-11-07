// POST /api/v1/auth/login   { email, password }  -> 200 + session cookie | 400 | 401
// POST /api/v1/auth/logout                        -> 204, clears the cookie
// GET  /api/v1/auth/me                            -> 200 { user } | 401
import { DEMO_USER } from "../lib/seed.ts";
import { isBugMode } from "../lib/bugs.ts";
import { error, json, methodNotAllowed, readJson } from "../lib/http.ts";
import { clearSessionCookie, newSession, readSession, sessionCookie } from "../lib/session.ts";

export default async (req: Request, context: { params?: Record<string, string> }): Promise<Response> => {
  const action = context.params?.action;

  if (action === "login") {
    if (req.method !== "POST") return methodNotAllowed(["POST"]);
    const body = await readJson(req);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!email || !password) return error(400, "missing_fields", "Email and password are required.");
    // PLANTED BUG-01: in bug mode, the demo account accepts ANY password.
    const passwordOk = isBugMode(req) || password === DEMO_USER.password;
    if (email !== DEMO_USER.email || !passwordOk) {
      return error(401, "invalid_credentials", "Incorrect email or password.");
    }
    const cookie = await sessionCookie(newSession(DEMO_USER.email), req);
    return json({ user: { email: DEMO_USER.email, name: DEMO_USER.name } }, 200, { "set-cookie": cookie });
  }

  if (action === "logout") {
    if (req.method !== "POST") return methodNotAllowed(["POST"]);
    return new Response(null, { status: 204, headers: { "set-cookie": clearSessionCookie(req) } });
  }

  if (action === "me") {
    if (req.method !== "GET") return methodNotAllowed(["GET"]);
    const state = await readSession(req);
    if (!state) return error(401, "unauthorized", "Sign in first.");
    return json({ user: { email: state.user, name: DEMO_USER.name } });
  }

  return error(404, "not_found", "Unknown auth action.");
};

export const config = { path: "/api/v1/auth/:action" };
