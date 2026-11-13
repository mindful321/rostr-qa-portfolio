# The Python test suite in a container: Pytest + Playwright (Chromium) + requests + psycopg.
# Build from the repo root:  docker build -f tests/Dockerfile .
FROM python:3.12-slim

WORKDIR /suite
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY tests/requirements.txt tests/requirements.txt
# Playwright's bundled Node needs libatomic1, which the slim image doesn't include.
RUN apt-get update && apt-get install -y --no-install-recommends libatomic1 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir -r tests/requirements.txt \
 && python -m playwright install --with-deps chromium

COPY pytest.ini ./
COPY tests ./tests

# Base URL and database come from docker compose; see docker-compose.yml.
CMD ["pytest", "-m", "api or evals or db or ui or a11y", "--browser", "chromium"]
