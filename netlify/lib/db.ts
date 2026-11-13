// Postgres storage, used only when DATABASE_URL is set (docker compose and CI).
// Without it, Rostr keeps each visitor's changes in their signed cookie (the live Netlify demo).
import { readFile } from "node:fs/promises";
import pg from "pg";
import { EMPLOYEES, SEED_BALANCES, SEED_REQUESTS } from "./seed.ts";
import type { Shift } from "./seed.ts";
import type { Decision, SessionState } from "./session.ts";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

export function isDbMode(): boolean {
  return Boolean(env.DATABASE_URL);
}

let pool: pg.Pool | null = null;
let ready: Promise<void> | null = null;

async function db(): Promise<pg.Pool> {
  if (!pool) pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5 });
  if (!ready) ready = prepare(pool);
  await ready;
  return pool;
}

/** Creates the tables (if needed) and loads the reference data. */
async function prepare(p: pg.Pool): Promise<void> {
  const schema = await readFile(new URL("../../db/schema.sql", import.meta.url), "utf8");
  await p.query(schema);
  for (const e of EMPLOYEES) {
    await p.query(
      `INSERT INTO employees (id, name, hourly_rate, pto_days) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, hourly_rate = EXCLUDED.hourly_rate, pto_days = EXCLUDED.pto_days`,
      [e.id, e.name, e.rate, SEED_BALANCES[e.id]],
    );
  }
  for (const r of SEED_REQUESTS) {
    await p.query(
      `INSERT INTO timeoff_requests (id, employee_id, days, dates, reason) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET employee_id = EXCLUDED.employee_id, days = EXCLUDED.days, dates = EXCLUDED.dates, reason = EXCLUDED.reason`,
      [r.id, r.employeeId, r.days, r.dates, r.reason],
    );
  }
}

export async function createSession(sid: string, userEmail: string): Promise<void> {
  const p = await db();
  await p.query("INSERT INTO sessions (id, user_email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", [sid, userEmail]);
}

/** Fills state.added and state.decisions from the database. Returns false if the session row is gone. */
export async function loadState(state: SessionState): Promise<boolean> {
  const p = await db();
  const s = await p.query("SELECT 1 FROM sessions WHERE id = $1", [state.sid]);
  if (s.rowCount === 0) return false;
  const shifts = await p.query(
    `SELECT id, employee_id, day, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS "end"
     FROM shifts WHERE session_id = $1 ORDER BY created_at, id`,
    [state.sid],
  );
  state.added = shifts.rows.map((r) => ({ id: r.id, employeeId: r.employee_id, day: Number(r.day), start: r.start, end: r.end }));
  const decisions = await p.query("SELECT request_id, decision FROM decisions WHERE session_id = $1", [state.sid]);
  state.decisions = Object.fromEntries(decisions.rows.map((r) => [r.request_id, r.decision as Decision]));
  return true;
}

/** Writes what a request changed: new shifts and decisions are inserted, removed ones deleted (reset). */
export async function saveChanges(before: SessionState, after: SessionState): Promise<void> {
  const p = await db();
  const sid = after.sid;
  const beforeIds = new Set(before.added.map((s) => s.id));
  const afterIds = new Set(after.added.map((s) => s.id));
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    for (const s of before.added) {
      if (!afterIds.has(s.id)) await client.query("DELETE FROM shifts WHERE session_id = $1 AND id = $2", [sid, s.id]);
    }
    for (const s of after.added as Shift[]) {
      if (beforeIds.has(s.id)) continue;
      await client.query(
        "INSERT INTO shifts (session_id, id, employee_id, day, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6)",
        [sid, s.id, s.employeeId, s.day, s.start, s.end],
      );
    }
    for (const id of Object.keys(before.decisions)) {
      if (!(id in after.decisions)) await client.query("DELETE FROM decisions WHERE session_id = $1 AND request_id = $2", [sid, id]);
    }
    for (const [id, decision] of Object.entries(after.decisions)) {
      if (before.decisions[id] === decision) continue;
      await client.query(
        `INSERT INTO decisions (session_id, request_id, decision) VALUES ($1, $2, $3)
         ON CONFLICT (session_id, request_id) DO UPDATE SET decision = EXCLUDED.decision, decided_at = now()`,
        [sid, id, decision],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
