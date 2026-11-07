"""Timesheet and payroll screen: the highest-risk area, because wrong pay is real money."""
from playwright.sync_api import expect


def test_maria_gets_four_hours_of_overtime(rostr):
    rostr.go_to("timesheet")
    expect(rostr.timesheet.hours("maria")).to_have_text("44")
    expect(rostr.timesheet.overtime("maria")).to_have_text("4")
    # 40 h x $22.50 + 4 h x $33.75 = $1,035.00
    expect(rostr.timesheet.gross("maria")).to_have_text("$1,035.00")


def test_pay_keeps_the_cents(rostr):
    rostr.go_to("timesheet")
    # Dev: 30 h x $19.83 = $594.90 (not $594)
    expect(rostr.timesheet.gross("dev")).to_have_text("$594.90")


def test_exactly_40_hours_has_no_overtime(rostr):
    rostr.go_to("timesheet")
    expect(rostr.timesheet.overtime("aisha")).to_have_text("0")
    expect(rostr.timesheet.gross("aisha")).to_have_text("$960.00")


def test_total_is_the_sum_of_all_rows(rostr):
    rostr.go_to("timesheet")
    expect(rostr.timesheet.total).to_have_text("$2,589.90")


def test_new_shift_updates_hours_and_pay(rostr):
    rostr.schedule.add_shift("Dev P.", "Tue", "09:00", "13:00")
    expect(rostr.schedule.notice_ok).to_be_visible()
    rostr.go_to("timesheet")
    expect(rostr.timesheet.hours("dev")).to_have_text("34")
    expect(rostr.timesheet.gross("dev")).to_have_text("$674.22")
