-- Rostr database schema (Postgres). Used when the app runs with DATABASE_URL set
-- (docker compose, CI). The live Netlify demo keeps each visitor's data in a signed cookie instead.
-- Safe to run more than once.

-- Reference data (same for every visitor) ------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  hourly_rate  numeric(8, 2) NOT NULL CHECK (hourly_rate > 0),
  pto_days     integer NOT NULL CHECK (pto_days >= 0)
);

CREATE TABLE IF NOT EXISTS timeoff_requests (
  id           text PRIMARY KEY,
  employee_id  text NOT NULL REFERENCES employees (id),
  days         integer NOT NULL CHECK (days > 0),
  dates        text NOT NULL,
  reason       text NOT NULL
);

-- Per-visitor data -------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id          uuid PRIMARY KEY,
  user_email  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Shifts a visitor added on top of the seeded week (the seeded week itself lives in the app code).
CREATE TABLE IF NOT EXISTS shifts (
  session_id   uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  id           text NOT NULL,
  employee_id  text NOT NULL REFERENCES employees (id),
  day          smallint NOT NULL CHECK (day BETWEEN 0 AND 4),
  start_time   time NOT NULL,
  end_time     time NOT NULL CHECK (end_time > start_time),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, id)
);

CREATE TABLE IF NOT EXISTS decisions (
  session_id  uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  request_id  text NOT NULL REFERENCES timeoff_requests (id),
  decision    text NOT NULL CHECK (decision IN ('approved', 'denied')),
  decided_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, request_id)
);
