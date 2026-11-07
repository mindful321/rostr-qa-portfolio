"""Time-off requests and balances."""
import pytest
from playwright.sync_api import expect


@pytest.fixture
def time_off(rostr):
    rostr.go_to("timeoff")
    return rostr.time_off


def test_starting_balances(time_off):
    expect(time_off.balance("maria")).to_have_text("12 days")
    expect(time_off.balance("dev")).to_have_text("8 days")
    expect(time_off.balance("aisha")).to_have_text("10 days")


def test_approving_deducts_from_the_requester_only(time_off):
    time_off.approve("r1")  # Dev, 2 days
    expect(time_off.status("r1")).to_have_text("Approved")
    expect(time_off.balance("dev")).to_have_text("6 days")
    expect(time_off.balance("maria")).to_have_text("12 days")
    expect(time_off.balance("aisha")).to_have_text("10 days")


def test_denying_marks_denied_and_keeps_the_balance(time_off):
    time_off.deny("r1")
    expect(time_off.status("r1")).to_have_text("Denied")
    expect(time_off.balance("dev")).to_have_text("8 days")


def test_decided_request_has_no_buttons(time_off):
    time_off.approve("r2")
    expect(time_off.approve_button("r2")).to_have_count(0)


def test_decisions_survive_switching_tabs(rostr, time_off):
    time_off.approve("r2")
    rostr.go_to("schedule")
    rostr.go_to("timeoff")
    expect(time_off.status("r2")).to_have_text("Approved")
    expect(time_off.balance("aisha")).to_have_text("7 days")
