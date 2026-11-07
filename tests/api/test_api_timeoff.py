"""Time-off API: approvals, denials, balances and double decisions."""
import pytest

START = {"maria": 12, "dev": 8, "aisha": 10}


def test_requests_and_balances_shape(signed_in_api):
    data = signed_in_api.time_off().json()
    assert [r["id"] for r in data["requests"]] == ["r1", "r2"]
    assert all(r["status"] == "pending" for r in data["requests"])
    assert signed_in_api.balances() == START


@pytest.mark.parametrize("request_id, employee, days", [("r1", "dev", 2), ("r2", "aisha", 3)])
def test_approve_deducts_from_the_right_person_only(signed_in_api, request_id, employee, days):
    r = signed_in_api.decide(request_id, "approve")
    assert r.status_code == 200
    expected = {**START, employee: START[employee] - days}
    assert signed_in_api.balances() == expected


def test_deny_does_not_change_any_balance(signed_in_api):
    r = signed_in_api.decide("r1", "deny")
    assert r.status_code == 200
    status = {x["id"]: x["status"] for x in r.json()["requests"]}
    assert status["r1"] == "denied"
    assert signed_in_api.balances() == START


@pytest.mark.parametrize("first, second", [("approve", "approve"), ("approve", "deny"), ("deny", "approve")])
def test_a_request_can_only_be_decided_once(signed_in_api, first, second):
    assert signed_in_api.decide("r1", first).status_code == 200
    r = signed_in_api.decide("r1", second)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "already_decided"


@pytest.mark.parametrize("request_id, action", [("r99", "approve"), ("r1", "cancel")], ids=["unknown-request", "unknown-action"])
def test_unknown_request_or_action_is_404(signed_in_api, request_id, action):
    assert signed_in_api.decide(request_id, action).status_code == 404


def test_decisions_need_post(signed_in_api):
    assert signed_in_api.get("/timeoff/requests/r1/approve").status_code == 405


def test_time_off_needs_a_session(api):
    assert api.time_off().status_code == 401
    assert api.decide("r1", "approve").status_code == 401
