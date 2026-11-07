"""Payroll API, data-driven: the rules are 1.5x after 40 hours and rounding to the cent."""
from decimal import ROUND_HALF_UP, Decimal

import pytest


def expected_gross(hours: float, rate: float) -> float:
    """Independent re-implementation of the pay rule, using Decimal to avoid float surprises."""
    h, r = Decimal(str(hours)), Decimal(str(rate))
    ot = max(Decimal(0), h - 40)
    gross = (h - ot) * r + ot * r * Decimal("1.5")
    return float(gross.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


@pytest.mark.parametrize(
    "employee, hours, overtime, gross",
    [("maria", 44, 4, 1035.00), ("dev", 30, 0, 594.90), ("aisha", 40, 0, 960.00)],
)
def test_seeded_week_pay(signed_in_api, employee, hours, overtime, gross):
    row = signed_in_api.pay_row(employee)
    assert row["hours"] == hours
    assert row["overtimeHours"] == overtime
    assert row["regularHours"] == hours - overtime
    assert row["gross"] == gross
    assert row["gross"] == expected_gross(row["hours"], row["rate"])


def test_total_equals_sum_of_rows(signed_in_api):
    data = signed_in_api.payroll().json()
    assert data["total"] == round(sum(r["gross"] for r in data["rows"]), 2) == 2589.90


@pytest.mark.parametrize(
    "employee, day, start, end, new_hours",
    [
        ("dev", 1, "09:00", "13:00", 34),    # still under 40
        ("dev", 1, "08:00", "18:00", 40),    # lands exactly on 40: no overtime
        ("aisha", 0, "16:00", "17:30", 41.5),  # crosses 40 by 1.5 h
    ],
    ids=["under-40", "exactly-40", "crosses-40"],
)
def test_added_shift_changes_hours_and_pay(signed_in_api, employee, day, start, end, new_hours):
    assert signed_in_api.add_shift(employee, day, start, end).status_code == 201
    row = signed_in_api.pay_row(employee)
    assert row["hours"] == new_hours
    assert row["overtimeHours"] == max(0, new_hours - 40)
    assert row["gross"] == expected_gross(new_hours, row["rate"])


def test_period_and_rule_are_reported(signed_in_api):
    data = signed_in_api.payroll().json()
    assert data["period"] == {"start": "2026-11-09", "end": "2026-11-13"}
    assert data["overtimeRule"] == "1.5x after 40 hours"


def test_payroll_needs_a_session(api):
    assert api.payroll().status_code == 401
