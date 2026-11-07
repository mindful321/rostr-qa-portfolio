// Test results page: fills in the latest release-gate result.
// Source 1: the `results` branch on GitHub (updated by CI after every push to main).
// Source 2 (fallback): data/results.json, a snapshot shipped with the site.
const LIVE = "https://raw.githubusercontent.com/mindful321/rostr-qa-portfolio/results/results.json";
const SNAPSHOT = "data/results.json";
const GOLDEN = "data/golden_dataset.json";

const $ = (sel) => document.querySelector(sel);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

async function loadResults() {
  try {
    return { data: await getJson(`${LIVE}?t=${Date.now()}`), source: "live" };
  } catch {
    return { data: await getJson(SNAPSHOT), source: "snapshot" };
  }
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function shortTest(id) {
  // "test_api_auth::test_bad_credentials_get_401[wrong-password]" -> "test_bad_credentials_get_401"
  return id.split("::").pop().split("[")[0];
}

function renderResults({ data, source }) {
  const { run = {}, clean, bugMode, bugs } = data;
  $("[data-run-number]").textContent = run.number ?? "local";
  $("[data-run-date]").textContent = formatDate(data.generatedAt);
  if (run.url) $("[data-run-link]").href = run.url;

  const cleanOk = clean.failed === 0;
  const cleanCard = $("[data-testid=decision-clean]");
  cleanCard.classList.toggle("go", cleanOk);
  cleanCard.classList.toggle("nogo", !cleanOk);
  $("[data-clean-stamp]").textContent = cleanOk ? "GO" : "NO-GO";
  $("[data-clean-headline]").textContent = cleanOk
    ? "All checks passed. Safe to ship."
    : `Blocked: ${clean.failed} test(s) failing on the clean build.`;

  const missed = bugs.filter((b) => !b.caught);
  $("[data-bugged-headline]").textContent = missed.length
    ? `Danger: ${missed.length} planted bug(s) slipped through.`
    : `Blocked: ${bugMode.failed} checks failed (payroll, auth, AI safety…)`;

  $("[data-testid=stat-clean]").textContent = `${clean.passed}/${clean.total}`;
  $("[data-testid=stat-caught]").textContent = `${bugMode.bugsCaught}/${bugMode.bugsPlanted}`;
  $("[data-testid=stat-duration]").textContent = `${Math.round(clean.seconds)}s`;

  $("[data-matrix]").innerHTML = bugs
    .map((b, i) => {
      const catcher = b.caught_by[0];
      return `<tr data-testid="matrix-row">
        <td>${String(i + 1).padStart(2, "0")}</td>
        <td class="wrap">${esc(b.summary)}</td>
        <td>${esc(b.area)}</td>
        <td>${esc(b.layer)}</td>
        <td class="mono">${catcher ? esc(shortTest(catcher)) : "–"}${b.caught_by.length > 1 ? ` <span title="${esc(b.caught_by.map(shortTest).join(", "))}">+${b.caught_by.length - 1}</span>` : ""}</td>
        <td class="pass">${cleanOk ? "PASS" : "–"}</td>
        <td>${b.caught ? '<span class="caught">FAIL ✓</span>' : '<span class="missed">MISSED</span>'}</td>
      </tr>`;
    })
    .join("");

  const when = new Date(data.generatedAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
  $("[data-testid=data-source]").innerHTML =
    source === "live"
      ? `Live results from the latest run on <code>main</code>${run.commit ? `, commit <a href="${esc(run.commitUrl)}">${esc(run.commit)}</a>` : ""} · ${esc(when)}`
      : `Showing a saved snapshot from ${esc(when)} (live results unavailable right now).`;
}

function renderGolden(dataset) {
  $("[data-golden]").innerHTML = dataset.cases
    .map(
      (c) => `<tr data-testid="golden-row"><td class="wrap">${esc(c.question)}</td><td class="wrap">${esc(c.must_include.join("; "))}</td><td class="mono wrap">${esc(c.check)}</td></tr>`,
    )
    .join("");
}

loadResults()
  .then(renderResults)
  .catch(() => {
    $("[data-testid=data-source]").textContent = "Couldn't load the test results. Try again in a moment.";
  });

getJson(GOLDEN)
  .then(renderGolden)
  .catch(() => {
    $("[data-golden]").innerHTML = `<tr><td colspan="3">Couldn't load the golden dataset.</td></tr>`;
  });
