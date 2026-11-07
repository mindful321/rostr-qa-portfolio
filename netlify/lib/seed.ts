// Rostr's demo data. Every visitor starts from this seed; their changes are kept as a small diff.

export type Employee = { id: string; name: string; rate: number };
export type Shift = { id: string; employeeId: string; day: number; start: string; end: string };
export type TimeOffRequest = {
  id: string;
  employeeId: string;
  days: number;
  dates: string;
  reason: string;
};

/** Monday of the demo week (fixed, so tests are deterministic). */
export const WEEK_START = "2026-11-09";
export const TIME_ZONE = "America/Edmonton";
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const OVERTIME_AFTER_HOURS = 40;
export const OVERTIME_MULTIPLIER = 1.5;

export const EMPLOYEES: Employee[] = [
  { id: "maria", name: "Maria L.", rate: 22.5 },
  { id: "dev", name: "Dev P.", rate: 19.83 },
  { id: "aisha", name: "Aisha K.", rate: 24 },
];

export const SEED_SHIFTS: Shift[] = [
  { id: "s1", employeeId: "maria", day: 0, start: "09:00", end: "17:00" },
  { id: "s2", employeeId: "maria", day: 1, start: "09:00", end: "17:00" },
  { id: "s3", employeeId: "maria", day: 2, start: "09:00", end: "17:00" },
  { id: "s4", employeeId: "maria", day: 3, start: "09:00", end: "19:00" },
  { id: "s5", employeeId: "maria", day: 4, start: "09:00", end: "19:00" },
  { id: "s6", employeeId: "dev", day: 0, start: "12:00", end: "20:00" },
  { id: "s7", employeeId: "dev", day: 2, start: "12:00", end: "20:00" },
  { id: "s8", employeeId: "dev", day: 3, start: "08:00", end: "16:00" },
  { id: "s9", employeeId: "dev", day: 4, start: "12:00", end: "18:00" },
  { id: "s10", employeeId: "aisha", day: 0, start: "08:00", end: "16:00" },
  { id: "s11", employeeId: "aisha", day: 1, start: "08:00", end: "16:00" },
  { id: "s12", employeeId: "aisha", day: 2, start: "08:00", end: "16:00" },
  { id: "s13", employeeId: "aisha", day: 3, start: "08:00", end: "16:00" },
  { id: "s14", employeeId: "aisha", day: 4, start: "08:00", end: "16:00" },
];

export const SEED_REQUESTS: TimeOffRequest[] = [
  { id: "r1", employeeId: "dev", days: 2, dates: "Nov 19 – 20", reason: "Family visit" },
  { id: "r2", employeeId: "aisha", days: 3, dates: "Dec 1 – 3", reason: "Vacation" },
];

export const SEED_BALANCES: Record<string, number> = { maria: 12, dev: 8, aisha: 10 };

export const DEMO_USER = { email: "manager@rostr.demo", password: "password", name: "Manager" };

export function employeeName(id: string): string {
  return EMPLOYEES.find((e) => e.id === id)?.name ?? id;
}
