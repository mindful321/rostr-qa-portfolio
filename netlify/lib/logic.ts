// Pure business rules: time maths, overlaps, payroll, week dates. No I/O, easy to unit test.
import { OVERTIME_AFTER_HOURS, OVERTIME_MULTIPLIER, WEEK_START, DAY_NAMES } from "./seed.ts";
import type { Shift } from "./seed.ts";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(t: unknown): t is string {
  return typeof t === "string" && TIME_RE.test(t);
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function shiftHours(s: Pick<Shift, "start" | "end">): number {
  return (toMinutes(s.end) - toMinutes(s.start)) / 60;
}

/** Two shifts on the same day overlap if each starts before the other ends. */
export function overlaps(a: Pick<Shift, "start" | "end">, b: Pick<Shift, "start" | "end">): boolean {
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type PayLine = { hours: number; regularHours: number; overtimeHours: number; rate: number; gross: number };

/** Hours up to 40 are paid at the rate, hours after 40 at 1.5×. Gross is rounded to the cent. */
export function computePay(hours: number, rate: number, bug = false): PayLine {
  // PLANTED BUG-06: in bug mode, overtime is never counted.
  const overtimeHours = bug ? 0 : Math.max(0, hours - OVERTIME_AFTER_HOURS);
  const regularHours = hours - overtimeHours;
  const exact = regularHours * rate + overtimeHours * rate * OVERTIME_MULTIPLIER;
  // PLANTED BUG-07: in bug mode, pay is truncated to whole dollars instead of rounded to the cent.
  const gross = bug ? Math.floor(exact) : round2(exact);
  return { hours, regularHours, overtimeHours, rate, gross };
}

/** Labels for the demo week, e.g. "Mon Nov 9". */
export function weekDays(bug = false): { index: number; date: string; label: string }[] {
  const monday = new Date(`${WEEK_START}T12:00:00Z`);
  // PLANTED BUG-02: in bug mode, the week starts a day early (Sunday Nov 8 labelled as Monday).
  if (bug) monday.setUTCDate(monday.getUTCDate() - 1);
  return DAY_NAMES.map((name, index) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + index);
    const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    return { index, date: d.toISOString().slice(0, 10), label: `${name} ${month} ${d.getUTCDate()}` };
  });
}
