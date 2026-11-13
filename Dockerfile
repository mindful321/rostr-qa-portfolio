# Rostr app (site + API) in a container. In docker compose it runs with DATABASE_URL set,
# so visitor data is stored in Postgres instead of the signed cookie.
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY site ./site
COPY netlify ./netlify
COPY scripts/dev-server.mjs ./scripts/dev-server.mjs
COPY db ./db
# The Test results page shows the golden dataset; the dev server copies it into site/data on start.
COPY tests/evals/golden_dataset.json ./tests/evals/golden_dataset.json

# The dev server writes site/data/golden_dataset.json on start, so the app user needs to own site/.
RUN mkdir -p site/data && chown -R node:node site

EXPOSE 8888
USER node
HEALTHCHECK --interval=5s --timeout=3s --retries=20 \
  CMD node -e "fetch('http://localhost:8888/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "scripts/dev-server.mjs", "8888"]
