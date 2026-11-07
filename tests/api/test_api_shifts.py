"""Shifts API: schedule shape, time zones, validation and the overlap rule."""
import re

import pytest

TIME = re.compile(r"^\d{2}:\d{2}$")


def test_schedule_needs_a_session(api):
    assert api.schedule().status_code == 401


def test_schedule_shape(signed_in_api):
    r = signed_in_api.schedule()
    assert r.status_code == 200
    data = r.json()
    assert data["weekStart"] == "2026-11-09"
    assert data["timeZone"] == "America/Edmonton"
    assert [d["label"] for d in data["days"]] == ["Mon Nov 9", "Tue Nov 10", "Wed Nov 11", "Thu Nov 12", "Fri Nov 13"]
    assert len(data["shifts"]) == 14
    for s in data["shifts"]:
        assert set(s) >= {"id", "employeeId", "employeeName", "day", "start", "end", "hours"}
        assert 0 <= s["day"] <= 4
        assert TIME.match(s["start"]) and TIME.match(s["end"])
        assert s["hours"] > 0


def test_edmonton_time_zone_is_supported(signed_in_api):
    assert signed_in_api.schedule(tz="America/Edmonton").status_code == 200


@pytest.mark.parametrize("tz", ["UTC", "America/Toronto", "not-a-zone"])
def test_other_time_zones_get_400(signed_in_api, tz):
    r = signed_in_api.schedule(tz=tz)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "unsupported_time_zone"


def test_add_valid_shift_returns_201_and_appears_in_schedule(signed_in_api):
    r = signed_in_api.add_shift("dev", 1, "09:00", "13:00")
    assert r.status_code == 201
    shift = r.json()["shift"]
    assert shift == {**shift, "employeeId": "dev", "day": 1, "start": "09:00", "end": "13:00"}
    ids = [s["id"] for s in signed_in_api.schedule().json()["shifts"]]
    assert shift["id"] in ids


@pytest.mark.parametrize(
    "start, end",
    [("15:00", "21:00"), ("08:00", "10:00"), ("10:00", "12:00"), ("07:00", "18:00"), ("09:00", "17:00")],
    ids=["overlaps-end", "overlaps-start", "inside", "covers", "identical"],
)
def test_overlapping_shift_gets_409(signed_in_api, start, end):
    """Maria already works Wed 09:00-17:00."""
    r = signed_in_api.add_shift("maria", 2, start, end)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "shift_overlap"
    assert len(signed_in_api.schedule().json()["shifts"]) == 14


@pytest.mark.parametrize("start, end", [("17:00", "21:00"), ("06:00", "09:00")], ids=["right-after", "right-before"])
def test_back_to_back_shift_is_allowed(signed_in_api, start, end):
    assert signed_in_api.add_shift("maria", 2, start, end).status_code == 201


def test_same_hours_for_a_different_person_is_fine(signed_in_api):
    # Dev is off on Tuesday, so the same 09:00-17:00 block that Maria works is allowed for him.
    assert signed_in_api.add_shift("dev", 1, "09:00", "17:00").status_code == 201


@pytest.mark.parametrize(
    "body, code",
    [
        ({"employeeId": "zoe", "day": 0, "start": "09:00", "end": "10:00"}, "unknown_employee"),
        ({"employeeId": "dev", "day": 5, "start": "09:00", "end": "10:00"}, "invalid_day"),
        ({"employeeId": "dev", "day": -1, "start": "09:00", "end": "10:00"}, "invalid_day"),
        ({"employeeId": "dev", "day": "1", "start": "09:00", "end": "10:00"}, "invalid_day"),
        ({"employeeId": "dev", "day": 1.5, "start": "09:00", "end": "10:00"}, "invalid_day"),
        ({"employeeId": "dev", "day": 1, "start": "9:00", "end": "10:00"}, "invalid_time"),
        ({"employeeId": "dev", "day": 1, "start": "09:00", "end": "24:00"}, "invalid_time"),
        ({"employeeId": "dev", "day": 1, "start": "09:60", "end": "10:00"}, "invalid_time"),
        ({"employeeId": "dev", "day": 1, "start": "10:00", "end": "10:00"}, "invalid_range"),
        ({"employeeId": "dev", "day": 1, "start": "18:00", "end": "09:00"}, "invalid_range"),
    ],
    ids=["unknown-employee", "day-too-big", "day-negative", "day-as-string", "day-not-integer",
         "time-no-leading-zero", "time-24h", "minutes-60", "zero-length", "end-before-start"],
)
def test_invalid_shift_gets_400(signed_in_api, body, code):
    r = signed_in_api.post("/shifts", body)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == code


def test_non_json_body_gets_400(signed_in_api):
    r = signed_in_api.session.post(f"{signed_in_api.base}/shifts", data="not json", headers={"content-type": "application/json"})
    assert r.status_code == 400


def test_delete_is_not_allowed(signed_in_api):
    r = signed_in_api.session.delete(f"{signed_in_api.base}/shifts")
    assert r.status_code == 405


def test_reset_removes_added_shifts(signed_in_api):
    signed_in_api.add_shift("dev", 1, "09:00", "13:00")
    assert signed_in_api.reset().status_code == 200
    assert len(signed_in_api.schedule().json()["shifts"]) == 14


def test_two_visitors_do_not_see_each_others_changes(signed_in_api, base_url, bug_mode):
    from support.api_client import RostrApi
    from conftest import DEMO_EMAIL, DEMO_PASSWORD

    signed_in_api.add_shift("dev", 1, "09:00", "13:00")
    other = RostrApi(base_url, bug_mode=bug_mode)
    other.login(DEMO_EMAIL, DEMO_PASSWORD)
    assert len(other.schedule().json()["shifts"]) == 14
