"""Week schedule screen."""
from playwright.sync_api import expect


def test_week_header_shows_monday_nov_9_to_friday_nov_13(rostr):
    expect(rostr.schedule.day_headers).to_have_text(
        ["Mon Nov 9", "Tue Nov 10", "Wed Nov 11", "Thu Nov 12", "Fri Nov 13"]
    )


def test_seeded_week_has_14_shifts(rostr):
    expect(rostr.schedule.shifts).to_have_count(14)


def test_dev_is_off_on_tuesday(rostr):
    expect(rostr.schedule.cell("dev", 1)).to_have_text("Off")


def test_overlapping_shift_is_blocked(rostr):
    rostr.schedule.quick_add_overlap.click()
    expect(rostr.schedule.notice_error).to_contain_text("Overlaps an existing shift 09:00–17:00")
    # Maria's Wednesday still has only her original shift
    expect(rostr.schedule.cell("maria", 2).get_by_test_id("shift")).to_have_count(1)


def test_adding_a_valid_shift_shows_it_in_the_grid(rostr):
    rostr.schedule.add_shift("Dev P.", "Tue", "09:00", "13:00")
    expect(rostr.schedule.notice_ok).to_have_text("Shift added.")
    expect(rostr.schedule.cell("dev", 1)).to_have_text("09:00–13:00")
    expect(rostr.schedule.shifts).to_have_count(15)


def test_back_to_back_shifts_are_allowed(rostr):
    """Ending at 17:00 and starting at 17:00 is not an overlap (boundary case)."""
    rostr.schedule.add_shift("Maria L.", "Wed", "17:00", "21:00")
    expect(rostr.schedule.notice_ok).to_be_visible()
    expect(rostr.schedule.cell("maria", 2).get_by_test_id("shift")).to_have_count(2)


def test_end_before_start_is_rejected(rostr):
    rostr.schedule.add_shift("Aisha K.", "Mon", "18:00", "17:00")
    expect(rostr.schedule.notice_error).to_contain_text("End must be after start")


def test_reset_removes_added_shifts(rostr):
    rostr.schedule.add_shift("Dev P.", "Tue", "09:00", "13:00")
    expect(rostr.schedule.shifts).to_have_count(15)
    rostr.reset_data()
    expect(rostr.schedule.shifts).to_have_count(14)
