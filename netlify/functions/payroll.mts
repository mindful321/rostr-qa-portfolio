// GET /api/v1/payroll -> hours, overtime and gross pay per employee for the demo week
import { json, methodNotAllowed, withSession } from "../lib/http.ts";
import { payrollView } from "../lib/views.ts";
import { isBugMode } from "../lib/bugs.ts";

export default async (req: Request): Promise<Response> =>
  withSession(req, (state) => {
    if (req.method !== "GET") return methodNotAllowed(["GET"]);
    return json(payrollView(state, isBugMode(req)));
  });

export const config = { path: "/api/v1/payroll" };
