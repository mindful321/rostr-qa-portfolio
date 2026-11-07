// POST /api/v1/reset -> puts the visitor's data back to the seed (keeps them signed in)
import { json, methodNotAllowed, withSession } from "../lib/http.ts";

export default async (req: Request): Promise<Response> =>
  withSession(req, (state) => {
    if (req.method !== "POST") return methodNotAllowed(["POST"]);
    state.added = [];
    state.decisions = {};
    return json({ status: "reset" });
  });

export const config = { path: "/api/v1/reset" };
