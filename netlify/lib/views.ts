// Builds what the API returns from the seed plus the visitor's changes.
// `bug` = the visitor has bug mode on (see bugs.ts).
import { EMPLOYEES, SEED_BALANCES, SEED_REQUESTS, SEED_SHIFTS, TIME_ZONE, WEEK_START, employeeName } from "./seed.ts";
import type { Shift } from "./seed.ts";
import { computePay, shiftHours, weekDays } from "./logic.ts";
import type { SessionState } from "./session.ts";

export function allShifts(state: SessionState): Shift[] {
  return [...SEED_SHIFTS, ...state.added];
}

export function scheduleView(state: SessionState, bug = false) {
  return {
    weekStart: WEEK_START,
    timeZone: TIME_ZONE,
    days: weekDays(bug),
    employees: EMPLOYEES.map(({ id, name }) => ({ id, name })),
    shifts: allShifts(state)
      .map((s) => ({ ...s, employeeName: employeeName(s.employeeId), hours: shiftHours(s) }))
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)),
  };
}

export function balances(state: SessionState, bug = false): Record<string, number> {
  const left = { ...SEED_BALANCES };
  for (const r of SEED_REQUESTS) {
    if (state.decisions[r.id] !== "approved") continue;
    // PLANTED BUG-05: in bug mode, approved days always come off Maria's balance.
    left[bug ? "maria" : r.employeeId] -= r.days;
  }
  return left;
}

export function timeOffView(state: SessionState, bug = false) {
  const left = balances(state, bug);
  return {
    requests: SEED_REQUESTS.map((r) => ({
      ...r,
      employeeName: employeeName(r.employeeId),
      status: state.decisions[r.id] ?? "pending",
    })),
    balances: EMPLOYEES.map((e) => ({ employeeId: e.id, employeeName: e.name, daysLeft: left[e.id] })),
  };
}

export function payrollView(state: SessionState, bug = false) {
  const days = weekDays();
  const shifts = allShifts(state);
  const rows = EMPLOYEES.map((e) => {
    const hours = shifts.filter((s) => s.employeeId === e.id).reduce((sum, s) => sum + shiftHours(s), 0);
    return { employeeId: e.id, employeeName: e.name, ...computePay(hours, e.rate, bug) };
  });
  const total = Math.round(rows.reduce((sum, r) => sum + r.gross * 100, 0)) / 100;
  return {
    period: { start: days[0].date, end: days[days.length - 1].date },
    overtimeRule: "1.5x after 40 hours",
    rows,
    total,
  };
}
