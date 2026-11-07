// GET  /api/v1/shifts?tz=America/Edmonton  -> the demo week's schedule
// POST /api/v1/shifts { employeeId, day, start, end } -> 201 | 400 | 409 (overlap)
import { EMPLOYEES, TIME_ZONE } from "../lib/seed.ts";
import { error, json, methodNotAllowed, readJson, withSession } from "../lib/http.ts";
import { isValidTime, overlaps, toMinutes } from "../lib/logic.ts";
import { allShifts, scheduleView } from "../lib/views.ts";

export default async (req: Request): Promise<Response> =>
  withSession(req, async (state) => {
    if (req.method === "GET") {
      const tz = new URL(req.url).searchParams.get("tz") ?? TIME_ZONE;
      if (tz !== TIME_ZONE) return error(400, "unsupported_time_zone", `Only ${TIME_ZONE} is supported.`);
      return json(scheduleView(state));
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      if (!body) return error(400, "invalid_json", "Send a JSON body.");
      const { employeeId, day, start, end } = body;
      if (!EMPLOYEES.some((e) => e.id === employeeId)) return error(400, "unknown_employee", "Unknown employee.");
      if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 4) {
        return error(400, "invalid_day", "Day must be 0 (Mon) to 4 (Fri).");
      }
      if (!isValidTime(start) || !isValidTime(end)) return error(400, "invalid_time", "Times must be HH:MM.");
      if (toMinutes(end) <= toMinutes(start)) return error(400, "invalid_range", "End must be after start.");

      const clash = allShifts(state).find((s) => s.employeeId === employeeId && s.day === day && overlaps(s, { start, end }));
      if (clash) {
        return error(409, "shift_overlap", `Overlaps an existing shift ${clash.start}–${clash.end}.`);
      }

      const shift = { id: `a${Date.now().toString(36)}${state.added.length}`, employeeId: employeeId as string, day, start, end };
      state.added.push(shift);
      return json({ shift }, 201);
    }

    return methodNotAllowed(["GET", "POST"]);
  });

export const config = { path: "/api/v1/shifts" };
