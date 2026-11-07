# Rostr QA Portfolio

Natalia Krasnova's portfolio site, and **Rostr**: a small workforce app (scheduling, time off, payroll, an assistant) with a **bug mode** that plants 10 real defects. A Python test suite runs against the app twice, once clean and once bugged, and acts as a **release gate**: the clean run must pass, and the bugged run must catch every planted bug.

Live site: https://nataliakrasnova.netlify.app (coming soon)

## Status

- [x] Home page
- [x] Rostr app (clean): login, schedule, time off, timesheet, Ask Rostr
- [x] Test suite: 141 Python tests (UI, API, assistant evals, accessibility) + 11 TypeScript unit tests
- [ ] Bug mode + release gate
- [ ] Ask Rostr assistant + eval-style tests
- [ ] Live test results page

## How it's built

| Part | Tech |
| --- | --- |
| Pages | Plain HTML + CSS (`site/`) |
| API | Netlify Functions in TypeScript (`netlify/functions/`) |
| Tests | Python: Pytest, Playwright, requests (`tests/`) |
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

Add `--bug-mode` to run the suite with Rostr's planted bugs switched on (once bug mode exists).
