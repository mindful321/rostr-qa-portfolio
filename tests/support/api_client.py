"""Thin client for Rostr's REST API. Keeps tests readable: api.add_shift(...) instead of raw URLs."""
import requests

TIMEOUT = 15


class RostrApi:
    def __init__(self, base_url: str, bug_mode: bool = False):
        self.base = f"{base_url.rstrip('/')}/api/v1"
        self.session = requests.Session()
        self.session.cookies.set("bug_mode", "on" if bug_mode else "off")

    # --- raw helpers -------------------------------------------------------------------------
    def get(self, path: str, **kw) -> requests.Response:
        return self.session.get(f"{self.base}{path}", timeout=TIMEOUT, **kw)

    def post(self, path: str, json=None, **kw) -> requests.Response:
        return self.session.post(f"{self.base}{path}", json=json, timeout=TIMEOUT, **kw)

    # --- auth --------------------------------------------------------------------------------
    def login(self, email: str, password: str) -> requests.Response:
        return self.post("/auth/login", {"email": email, "password": password})

    def logout(self) -> requests.Response:
        return self.post("/auth/logout")

    def me(self) -> requests.Response:
        return self.get("/auth/me")

    # --- features ----------------------------------------------------------------------------
    def schedule(self, tz: str | None = None) -> requests.Response:
        """tz=None uses the server default (America/Edmonton)."""
        return self.get("/shifts", params={"tz": tz} if tz else None)

    def add_shift(self, employee_id: str, day: int, start: str, end: str) -> requests.Response:
        return self.post("/shifts", {"employeeId": employee_id, "day": day, "start": start, "end": end})

    def time_off(self) -> requests.Response:
        return self.get("/timeoff")

    def decide(self, request_id: str, action: str) -> requests.Response:
        return self.post(f"/timeoff/requests/{request_id}/{action}")

    def balances(self) -> dict[str, int]:
        return {b["employeeId"]: b["daysLeft"] for b in self.time_off().json()["balances"]}

    def payroll(self) -> requests.Response:
        return self.get("/payroll")

    def pay_row(self, employee_id: str) -> dict:
        return next(r for r in self.payroll().json()["rows"] if r["employeeId"] == employee_id)

    def ask(self, question: str) -> requests.Response:
        return self.post("/assistant", {"question": question})

    def reset(self) -> requests.Response:
        return self.post("/reset")
