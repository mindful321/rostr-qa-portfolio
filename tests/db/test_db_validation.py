"""SQL validation: the API says something happened, the database must agree.

Each test does something through the API, then queries Postgres directly to check what was
really stored. Runs only when DATABASE_URL is set (docker compose / CI), against the same
database the app uses.
"""
import psycopg
import pytest

from conftest import DEMO_EMAIL, DEMO_PASSWORD, session_id
from support.api_client import RostrApi


def count(sql, query: str, *params) -> int:
    return sql.execute(query, params).fetchone()["n"]


# --- schema -------------------------------------------------------------------------------------

def test_tables_and_reference_data_exist(sql):
    tables = {r["table_name"] for r in sql.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    ).fetchall()}
    assert {"employees", "timeoff_requests", "sessions", "shifts", "decisions"} <= tables
    employees = sql.execute("SELECT id, name, hourly_rate, pto_days FROM employees ORDER BY id").fetchall()
    assert [(e["id"], float(e["hourly_rate"]), e["pto_days"]) for e in employees] == [
        ("aisha", 24.0, 10), ("dev", 19.83, 8), ("maria", 22.5, 12),
    ]


def test_database_rejects_a_shift_for_an_unknown_employee(sql, signed_in_api):
    """The foreign key is the last line of defence if the API's own check ever breaks."""
    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        sql.execute(
            "INSERT INTO shifts (session_id, id, employee_id, day, start_time, end_time) VALUES (%s, 'x', 'zoe', 0, '09:00', '10:00')",
            (session_id(signed_in_api),),
        )


def test_database_rejects_a_shift_that_ends_before_it_starts(sql, signed_in_api):
    with pytest.raises(psycopg.errors.CheckViolation):
        sql.execute(
            "INSERT INTO shifts (session_id, id, employee_id, day, start_time, end_time) VALUES (%s, 'y', 'dev', 0, '18:00', '09:00')",
            (session_id(signed_in_api),),
        )


# --- sessions and shifts ------------------------------------------------------------------------

def test_login_creates_a_session_row(sql, signed_in_api):
    row = sql.execute("SELECT user_email FROM sessions WHERE id = %s", (session_id(signed_in_api),)).fetchone()
    assert row == {"user_email": DEMO_EMAIL}


def test_added_shift_is_stored_exactly(sql, signed_in_api):
    created = signed_in_api.add_shift("dev", 1, "09:00", "13:00").json()["shift"]
    row = sql.execute(
        "SELECT employee_id, day, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS \"end\" "
        "FROM shifts WHERE session_id = %s AND id = %s",
        (session_id(signed_in_api), created["id"]),
    ).fetchone()
    assert row == {"employee_id": "dev", "day": 1, "start": "09:00", "end": "13:00"}


def test_rejected_overlapping_shift_is_not_stored(sql, signed_in_api):
    """A 409 from the API must mean nothing was written."""
    sid = session_id(signed_in_api)
    response = signed_in_api.add_shift("maria", 2, "15:00", "21:00")
    stored = count(sql, "SELECT count(*) AS n FROM shifts WHERE session_id = %s AND employee_id = 'maria' AND day = 2", sid)
    assert (response.status_code, stored) == (409, 0)


def test_hours_in_payroll_match_the_stored_shifts(sql, signed_in_api):
    signed_in_api.add_shift("dev", 1, "09:00", "13:00")
    signed_in_api.add_shift("dev", 4, "18:00", "20:30")
    stored_hours = sql.execute(
        "SELECT COALESCE(sum(EXTRACT(EPOCH FROM end_time - start_time) / 3600), 0) AS h "
        "FROM shifts WHERE session_id = %s AND employee_id = 'dev'",
        (session_id(signed_in_api),),
    ).fetchone()["h"]
    seeded_dev_hours = 30
    assert signed_in_api.pay_row("dev")["hours"] == seeded_dev_hours + float(stored_hours) == 36.5


# --- time off -----------------------------------------------------------------------------------

@pytest.mark.parametrize("action, expected", [("approve", "approved"), ("deny", "denied")])
def test_decision_is_stored_as_made(sql, signed_in_api, action, expected):
    signed_in_api.decide("r1", action)
    row = sql.execute(
        "SELECT decision FROM decisions WHERE session_id = %s AND request_id = 'r1'", (session_id(signed_in_api),)
    ).fetchone()
    assert row == {"decision": expected}


BALANCES_SQL = """
    SELECT e.id, e.pto_days - COALESCE(sum(r.days) FILTER (WHERE d.decision = 'approved'), 0) AS days_left
    FROM employees e
    LEFT JOIN timeoff_requests r ON r.employee_id = e.id
    LEFT JOIN decisions d ON d.request_id = r.id AND d.session_id = %s
    GROUP BY e.id, e.pto_days
"""


@pytest.mark.parametrize("request_id", ["r1", "r2"])
def test_api_balances_match_balances_computed_in_sql(sql, signed_in_api, request_id):
    signed_in_api.decide(request_id, "approve")
    from_sql = {r["id"]: r["days_left"] for r in sql.execute(BALANCES_SQL, (session_id(signed_in_api),)).fetchall()}
    assert signed_in_api.balances() == from_sql


# --- reset and isolation ------------------------------------------------------------------------

def test_reset_deletes_only_this_visitors_rows(sql, signed_in_api, base_url, bug_mode):
    other = RostrApi(base_url, bug_mode=bug_mode)
    other.login(DEMO_EMAIL, DEMO_PASSWORD)
    other.add_shift("aisha", 0, "16:00", "18:00")
    signed_in_api.add_shift("dev", 1, "09:00", "13:00")
    signed_in_api.decide("r2", "approve")

    signed_in_api.reset()

    mine, theirs = session_id(signed_in_api), session_id(other)
    assert count(sql, "SELECT count(*) AS n FROM shifts WHERE session_id = %s", mine) == 0
    assert count(sql, "SELECT count(*) AS n FROM decisions WHERE session_id = %s", mine) == 0
    assert count(sql, "SELECT count(*) AS n FROM shifts WHERE session_id = %s", theirs) == 1
