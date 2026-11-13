# Rostr QA Portfolio

Natalia Krasnova's portfolio site, and **Rostr**: a small workforce app (scheduling, time off, payroll, an assistant) with a **bug mode** that plants 10 real defects. A Python test suite runs against the app twice, once clean and once bugged, and acts as a **release gate**: the clean run must pass, and the bugged run must catch every planted bug.

Live site: https://nataliakrasnova.netlify.app (coming soon)

## Status

- [x] Home page
- [x] Rostr app (clean): login, schedule, time off, timesheet, Ask Rostr
- [x] Test suite: 141 Python tests (UI, API, assistant evals, accessibility) + 11 TypeScript unit tests
- [x] Bug mode + release gate: 10 planted bugs, CI blocks the release unless every one is caught
- [ ] Ask Rostr assistant + eval-style tests
- [x] Live Test results page: CI publishes results.json to the `results` branch after every push to main; /results reads it (falls back to a snapshot)

## How it's built

| Part | Tech |
| --- | --- |
| Pages | Plain HTML + CSS (`site/`) |
| API | Netlify Functions in TypeScript (`netlify/functions/`) |
| Tests | Python: Pytest, Playwright, requests, psycopg (`tests/`) |
| Database | Postgres via Docker Compose (`db/schema.sql`); cookie storage on the live demo |
| CI | GitHub Actions (`.github/workflows/`) |

## Test suite

| Layer | Where | What it covers |
| --- | --- | --- |
| UI | `tests/ui/` | Login, schedule, time off, timesheet, Ask Rostr, phone and tablet sizes (Playwright, Page Object Model) |
| API | `tests/api/` | Every endpoint: auth, tampered cookies, validation, overlaps, double decisions, payroll maths |
| Assistant evals | `tests/evals/` | Golden dataset: correctness, no made-up people, prompt-injection refusals |
| Accessibility | `tests/a11y/` | axe-core WCAG 2.1 AA scan of every page and screen |
| Unit | `tests/unit/` | Pay, overtime, rounding, time and overlap rules (TypeScript, `node --test`) |

CI runs the unit, API and eval jobs, and the UI + accessibility job in Chromium, Firefox and WebKit.

## Run it locally

```bash
# 1. start the site + API (needs Node 22.18+)
npm run dev

# 2. in another terminal: install and run the tests
python -m venv .venv
.venv\Scripts\activate          # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r tests/requirements.txt
python -m playwright install chromium
pytest --base-url http://localhost:8888            # everything
pytest -m api --base-url http://localhost:8888     # one layer: ui, api, evals, a11y, smoke
npm run test:unit                                  # TypeScript unit tests
```

## Run everything in Docker (with Postgres)

```bash
docker compose up --build --abort-on-container-exit --exit-code-from tests
```

This starts three containers: **Postgres**, the **Rostr app** (with `DATABASE_URL` set, so visitor data is stored in Postgres instead of the signed cookie) and the **test suite**, including the SQL checks in `tests/db/` that query the database directly after each API action (stored shifts, rejected overlaps leave no row, decisions, balances computed in SQL, reset isolation). The schema is in `db/schema.sql`. CI runs the same command in the `docker compose` job.

The live Netlify demo has no database: each visitor's changes travel in a signed cookie.

## Bug mode and the release gate

Switching on bug mode (the toggle on `/demo`, or `--bug-mode` in pytest) sets a `bug_mode=on` cookie, and Rostr plants 10 real defects. Each one is a small branch in the app code marked `PLANTED BUG-NN` (`netlify/lib/bugs.ts` lists them).

The **release gate** (`scripts/release_gate.py`, CI job `release gate`) runs the suite twice:

1. **Clean build:** every test must pass.
2. **Bug mode:** every bug in `tests/bug_catalog.json` must be caught by at least one of its tests.

Both true → **GO**. Anything else → **NO-GO**, and the job fails.

```bash
pytest --base-url http://localhost:8888 --junitxml=clean.xml
pytest --base-url http://localhost:8888 --bug-mode --junitxml=bugged.xml
python scripts/release_gate.py --clean clean.xml --bugged bugged.xml
```
