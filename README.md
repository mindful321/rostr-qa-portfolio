# Rostr QA Portfolio

Natalia Krasnova's portfolio site, and **Rostr**: a small workforce app (scheduling, time off, payroll, an assistant) with a **bug mode** that plants 10 real defects. A Python test suite runs against the app twice, once clean and once bugged, and acts as a **release gate**: the clean run must pass, and the bugged run must catch every planted bug.

Live site: https://nataliakrasnova.netlify.app (coming soon)

## Status

- [x] Home page
- [x] Rostr app (clean): login, schedule, time off, timesheet, Ask Rostr
- [ ] Python test suite
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

## Run it locally

```bash
# serve the site + API (needs Node 22.18+)
npm run dev

# in another terminal: install and run the tests
python -m venv .venv
.venv\Scripts\activate          # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r tests/requirements.txt
python -m playwright install chromium
pytest --base-url http://localhost:8888
```

Add `--bug-mode` to run the suite with Rostr's planted bugs switched on (once bug mode exists).
