// GET  /api/v1/timeoff                           -> requests + balances
// POST /api/v1/timeoff/requests/:id/approve|deny -> 200 | 404 | 409 (already decided)
import { SEED_REQUESTS } from "../lib/seed.ts";
import { error, json, methodNotAllowed, withSession } from "../lib/http.ts";
import { timeOffView } from "../lib/views.ts";

export default async (req: Request, context: { params?: Record<string, string> }): Promise<Response> =>
  withSession(req, (state) => {
    const { id, action } = context.params ?? {};

    if (!id) {
      if (req.method !== "GET") return methodNotAllowed(["GET"]);
      return json(timeOffView(state));
    }

    if (req.method !== "POST") return methodNotAllowed(["POST"]);
    if (!SEED_REQUESTS.some((r) => r.id === id)) return error(404, "not_found", "No such request.");
    if (action !== "approve" && action !== "deny") return error(404, "not_found", "Use approve or deny.");
    if (state.decisions[id]) return error(409, "already_decided", `Request was already ${state.decisions[id]}.`);

    state.decisions[id] = action === "approve" ? "approved" : "denied";
    return json(timeOffView(state));
  });

export const config = { path: ["/api/v1/timeoff", "/api/v1/timeoff/requests/:id/:action"] };
