// Rostr front end: plain JavaScript, talks to /api/v1/*. Every interactive element has a data-testid.
const API = "/api/v1";
const app = document.getElementById("rostr-app");
const body = document.getElementById("rostr-body");
const nav = document.getElementById("rostr-nav");
const urlBar = document.getElementById("rostr-url");
const netlog = document.getElementById("rostr-netlog");

const TABS = [
  { id: "schedule", label: "Schedule" },
  { id: "timeoff", label: "Time off" },
  { id: "timesheet", label: "Timesheet" },
  { id: "assistant", label: "Ask Rostr" },
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
let current = "schedule";
let chat = [];

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (n) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function logRequest(method, path, status) {
  const line = document.createElement("div");
  line.className = "netlog-line";
  line.dataset.testid = "netlog-line";
  const code = document.createElement("span");
  code.className = status >= 400 ? "err" : "ok";
  code.textContent = status;
  const text = document.createElement("span");
  text.textContent = `${method} ${path}`;
  line.append(code, text);
  netlog.querySelector("[data-netlog-empty]")?.remove();
  netlog.prepend(line);
  while (netlog.querySelectorAll(".netlog-line").length > 8) netlog.lastElementChild.remove();
}

async function api(path, { method = "GET", data } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: data ? { "content-type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "same-origin",
  });
  logRequest(method, `${API}${path}`, res.status);
  const payload = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data: payload };
}

function setUrl(path) {
  urlBar.textContent = `rostr.demo/${path}`;
}

function renderNav(signedIn) {
  if (!signedIn) {
    nav.hidden = true;
    return;
  }
  nav.hidden = false;
  nav.querySelector("[data-tabs]").innerHTML = TABS.map(
    (t) => `<button class="tab" role="tab" type="button" data-tab="${t.id}" data-testid="tab-${t.id}" aria-selected="${t.id === current}">${t.label}</button>`,
  ).join("");
}

nav.addEventListener("click", (e) => {
  const tab = e.target.closest("[data-tab]");
  if (tab) return show(tab.dataset.tab);
  if (e.target.closest("[data-action=logout]")) return logout();
  if (e.target.closest("[data-action=reset]")) return resetData();
});

// ---------- Login ----------
function renderLogin(message = "") {
  setUrl("login");
  renderNav(false);
  body.innerHTML = `
    <form class="login" data-testid="login-form" novalidate>
      <div class="rostr-logo">Rostr</div>
      <div class="muted">Sign in to manage your team.</div>
      <label>Email <input type="email" name="email" autocomplete="username" data-testid="login-email" value="manager@rostr.demo" required></label>
      <label>Password <input type="password" name="password" autocomplete="current-password" data-testid="login-password" required></label>
      ${message ? `<div class="alert alert-error" role="alert" data-testid="login-error">${esc(message)}</div>` : ""}
      <button class="btn-app" type="submit" data-testid="login-submit">Sign in</button>
      <div class="login-hint">Demo login: <b>manager@rostr.demo</b> / <b>password</b></div>
    </form>`;
  body.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const res = await api("/auth/login", { method: "POST", data: { email: f.get("email"), password: f.get("password") } });
    if (res.ok) {
      current = "schedule";
      return show("schedule");
    }
    renderLogin(res.data?.error?.message ?? "Sign-in failed.");
  });
}

async function logout() {
  await api("/auth/logout", { method: "POST" });
  chat = [];
  renderLogin();
}

async function resetData() {
  await api("/reset", { method: "POST" });
  chat = [];
  show(current, "Demo data reset.");
}

// ---------- Schedule ----------
async function renderSchedule(notice) {
  const res = await api("/shifts?tz=America/Edmonton");
  if (res.status === 401) return renderLogin();
  if (!res.ok) return renderError(res);
  const { days, employees, shifts } = res.data;
  const rows = employees
    .map((emp) => {
      const cells = days
        .map((d) => {
          const mine = shifts.filter((s) => s.employeeId === emp.id && s.day === d.index);
          const content = mine.length
            ? mine.map((s) => `<span class="chip" data-testid="shift">${esc(s.start)}–${esc(s.end)}</span>`).join("")
            : `<span class="muted">Off</span>`;
          return `<td data-testid="cell-${emp.id}-${d.index}">${content}</td>`;
        })
        .join("");
      return `<tr data-testid="row-${emp.id}"><td><b>${esc(emp.name)}</b></td>${cells}</tr>`;
    })
    .join("");
  body.innerHTML = `
    <div class="row-between">
      <h2>Week schedule</h2>
      <button class="btn-app" type="button" data-testid="quick-add-overlap">+ Add shift: Maria, Wed 15:00–21:00</button>
    </div>
    <div data-notice></div>
    <div class="table-box">
      <table class="tbl" data-testid="schedule-table">
        <thead><tr><th>Employee</th>${days.map((d) => `<th data-testid="day-header">${esc(d.label)}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <form class="add-shift" data-testid="add-shift-form">
      <label>Employee <select name="employeeId" data-testid="shift-employee">${employees.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join("")}</select></label>
      <label>Day <select name="day" data-testid="shift-day">${DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join("")}</select></label>
      <label>Start <input type="time" name="start" value="09:00" data-testid="shift-start" required></label>
      <label>End <input type="time" name="end" value="13:00" data-testid="shift-end" required></label>
      <button class="btn-app" type="submit" data-testid="shift-submit">Add shift</button>
    </form>`;
  if (notice) setNotice(notice.text, notice.ok);
  const add = async (shift) => {
    const r = await api("/shifts", { method: "POST", data: shift });
    if (r.ok) return renderSchedule({ text: "Shift added.", ok: true });
    setNotice(`Can't save: ${r.data?.error?.message ?? "something went wrong."}`, false);
  };
  body.querySelector("[data-testid=quick-add-overlap]").addEventListener("click", () =>
    add({ employeeId: "maria", day: 2, start: "15:00", end: "21:00" }),
  );
  body.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    add({ employeeId: f.get("employeeId"), day: Number(f.get("day")), start: f.get("start"), end: f.get("end") });
  });
}

function setNotice(text, ok) {
  const box = body.querySelector("[data-notice]");
  if (!box) return;
  box.innerHTML = `<div class="alert ${ok ? "alert-ok" : "alert-error"}" role="${ok ? "status" : "alert"}" data-testid="${ok ? "notice-ok" : "notice-error"}">${esc(text)}</div>`;
}

// ---------- Time off ----------
async function renderTimeOff(notice) {
  const res = await api("/timeoff");
  if (res.status === 401) return renderLogin();
  if (!res.ok) return renderError(res);
  const { requests, balances } = res.data;
  body.innerHTML = `
    <h2 style="padding-bottom:16px">Time-off requests</h2>
    <div data-notice></div>
    <div class="cols">
      <div class="grow">
        ${requests
          .map(
            (r) => `
          <div class="request" data-testid="request-${r.id}">
            <div>
              <div><b>${esc(r.employeeName)}</b> · ${r.days} days</div>
              <div class="muted">${esc(r.dates)} · ${esc(r.reason)}</div>
            </div>
            ${
              r.status === "pending"
                ? `<div style="display:flex;gap:8px">
                     <button class="btn-approve" type="button" data-decide="approve" data-id="${r.id}" data-testid="approve-${r.id}">Approve</button>
                     <button class="btn-deny" type="button" data-decide="deny" data-id="${r.id}" data-testid="deny-${r.id}">Deny</button>
                   </div>`
                : `<span class="status" data-testid="status-${r.id}">${r.status === "approved" ? "Approved" : "Denied"}</span>`
            }
          </div>`,
          )
          .join("")}
      </div>
      <div class="side-box">
        <div style="font-weight:600;padding-bottom:8px">PTO balances</div>
        ${balances.map((b) => `<div class="balance"><span>${esc(b.employeeName)}</span><b data-testid="balance-${b.employeeId}">${b.daysLeft} days</b></div>`).join("")}
      </div>
    </div>`;
  if (notice) setNotice(notice.text, notice.ok);
  body.querySelectorAll("[data-decide]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const r = await api(`/timeoff/requests/${btn.dataset.id}/${btn.dataset.decide}`, { method: "POST" });
      if (!r.ok) return renderTimeOff({ text: r.data?.error?.message ?? "Something went wrong.", ok: false });
      renderTimeOff();
    }),
  );
}

// ---------- Timesheet ----------
async function renderTimesheet() {
  const res = await api("/payroll");
  if (res.status === 401) return renderLogin();
  if (!res.ok) return renderError(res);
  const { rows, total } = res.data;
  body.innerHTML = `
    <h2>Timesheet &amp; payroll</h2>
    <div class="muted" style="padding:4px 0 16px">Pay period Nov 9 – 13 · overtime is 1.5× after 40 h</div>
    <div class="table-box">
      <table class="tbl" data-testid="payroll-table">
        <thead><tr><th>Employee</th><th>Hours</th><th>Rate</th><th>Overtime h</th><th>Gross pay</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr data-testid="pay-${r.employeeId}"><td><b>${esc(r.employeeName)}</b></td><td data-testid="hours-${r.employeeId}">${r.hours}</td><td>${money(r.rate)}</td><td data-testid="ot-${r.employeeId}">${r.overtimeHours}</td><td data-testid="gross-${r.employeeId}"><b>${money(r.gross)}</b></td></tr>`,
            )
            .join("")}
          <tr class="total"><td>Total</td><td></td><td></td><td></td><td data-testid="pay-total">${money(total)}</td></tr>
        </tbody>
      </table>
    </div>`;
}

// ---------- Ask Rostr ----------
async function renderAssistant() {
  const res = await api("/assistant");
  if (res.status === 401) return renderLogin();
  if (!res.ok) return renderError(res);
  body.innerHTML = `
    <div class="row-between" style="padding-bottom:4px">
      <h2>Ask Rostr</h2>
      <span class="muted">Assistant · answers from your team's data</span>
    </div>
    <div class="muted" style="padding-bottom:14px">Pick a question or type your own:</div>
    <div class="suggestions">${res.data.suggestions.map((q, i) => `<button type="button" data-q="${esc(q)}" data-testid="suggestion-${i}">${esc(q)}</button>`).join("")}</div>
    <form class="ask-form" data-testid="ask-form">
      <label class="skip-link" for="ask-input">Your question</label>
      <input id="ask-input" name="question" maxlength="300" placeholder="Ask about schedules or time off" data-testid="ask-input">
      <button class="btn-app" type="submit" data-testid="ask-submit">Ask</button>
    </form>
    <div class="chat" data-testid="chat" aria-live="polite">${renderChat()}</div>`;
  const ask = async (question) => {
    if (!question.trim()) return;
    const r = await api("/assistant", { method: "POST", data: { question } });
    chat.push({ q: question, a: r.ok ? r.data.answer : r.data?.error?.message ?? "Something went wrong." });
    body.querySelector("[data-testid=chat]").innerHTML = renderChat();
  };
  body.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => ask(b.dataset.q)));
  body.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = e.target.question;
    ask(input.value);
    input.value = "";
  });
}

function renderChat() {
  if (!chat.length) return `<div class="muted">Answers appear here.</div>`;
  return chat
    .map(
      (m) => `<div class="bubble-q" data-testid="chat-question">${esc(m.q)}</div>
              <div class="bubble-a" data-testid="chat-answer"><div class="who">Rostr</div>${esc(m.a)}</div>`,
    )
    .join("");
}

function renderError(res) {
  body.innerHTML = `<div class="alert alert-error" role="alert" data-testid="app-error">Error ${res.status}: ${esc(res.data?.error?.message ?? "Something went wrong.")}</div>`;
}

// ---------- Router ----------
const SCREENS = { schedule: renderSchedule, timeoff: renderTimeOff, timesheet: renderTimesheet, assistant: renderAssistant };

function show(tab, noticeText) {
  current = tab;
  setUrl(tab);
  renderNav(true);
  return SCREENS[tab](noticeText ? { text: noticeText, ok: true } : undefined);
}

async function start() {
  const me = await api("/auth/me");
  if (me.ok) show("schedule");
  else renderLogin();
}

start();
