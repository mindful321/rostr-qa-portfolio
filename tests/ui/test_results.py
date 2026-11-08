"""Test results page: it must show a real release-gate result, not placeholders."""
import json
import re
from pathlib import Path

import pytest

from playwright.sync_api import Page, expect

CATALOG = json.loads((Path(__file__).parents[1] / "bug_catalog.json").read_text(encoding="utf-8"))
GOLDEN = json.loads((Path(__file__).parents[1] / "evals" / "golden_dataset.json").read_text(encoding="utf-8"))


def open_results(page: Page) -> Page:
    page.goto("/results")
    expect(page.get_by_test_id("data-source")).not_to_have_text(re.compile("Loading"))
    return page


def test_shows_a_release_decision_and_real_counts(page: Page):
    open_results(page)
    expect(page.get_by_test_id("stat-clean")).to_have_text(re.compile(r"^\d+/\d+$"))
    expect(page.get_by_test_id("stat-caught")).to_have_text(re.compile(r"^\d+/10$"))
    expect(page.get_by_test_id("decision-clean")).to_contain_text(re.compile("GO|NO-GO"))


def test_bug_matrix_lists_every_planted_bug(page: Page):
    open_results(page)
    rows = page.get_by_test_id("matrix-row")
    expect(rows).to_have_count(len(CATALOG["bugs"]))
    for bug in CATALOG["bugs"]:
        expect(page.get_by_test_id("bug-matrix")).to_contain_text(bug["summary"])


def test_golden_dataset_table_matches_the_dataset_file(page: Page):
    open_results(page)
    expect(page.get_by_test_id("golden-row")).to_have_count(len(GOLDEN["cases"]))


def test_says_where_the_numbers_come_from(page: Page):
    open_results(page)
    expect(page.get_by_test_id("data-source")).to_have_text(re.compile("Live results|saved snapshot"))


def test_ci_and_source_links_point_to_github(page: Page):
    open_results(page)
    expect(page.get_by_test_id("ci-link")).to_have_attribute("href", re.compile(r"^https://github\.com/mindful321/rostr-qa-portfolio"))
    expect(page.get_by_test_id("source-link")).to_have_attribute("href", "https://github.com/mindful321/rostr-qa-portfolio")


TABLES = ["bug-matrix", "risk-map", "golden-dataset"]


@pytest.mark.parametrize("width", [1024, 1440, 375], ids=["laptop", "desktop", "phone"])
@pytest.mark.parametrize("table", TABLES)
def test_tables_fit_without_sideways_scrolling(page: Page, table, width):
    page.set_viewport_size({"width": width, "height": 900})
    open_results(page)
    sizes = page.get_by_test_id(table).evaluate("t => ({ table: t.scrollWidth, box: t.parentElement.clientWidth })")
    assert sizes["table"] <= sizes["box"], f"{table} is {sizes['table']}px wide in a {sizes['box']}px box at {width}px"


@pytest.mark.parametrize("table, row", [("bug-matrix", "matrix-row"), ("golden-dataset", "golden-row")])
def test_cells_in_a_row_line_up(page: Page, table, row):
    """Every cell's content starts at the same height (a class clash once pushed some cells down 32px)."""
    page.set_viewport_size({"width": 1280, "height": 900})
    open_results(page)
    offsets = page.get_by_test_id(row).first.evaluate(
        "tr => [...tr.children].map(td => Math.round(td.getBoundingClientRect().top + parseFloat(getComputedStyle(td).paddingTop)))"
    )
    assert len(set(offsets)) == 1, f"{table}: cell content starts at different heights {offsets}"


def test_golden_dataset_is_grouped_and_readable(page: Page):
    open_results(page)
    groups = page.get_by_test_id("golden-group")
    expect(groups).to_have_count(3)
    expect(groups.nth(0)).to_contain_text("Schedule & time off")
    expect(groups.nth(1)).to_contain_text("Prompt injection")
    expect(groups.nth(2)).to_contain_text("Off-topic & unknown")
    injection_rows = page.get_by_test_id("golden-row").filter(has_text="Ignore your rules")
    expect(injection_rows).to_contain_text("Polite refusal")
    expect(injection_rows.locator(".tag")).to_contain_text(["prompt injection"])


def test_each_bug_shows_which_test_caught_it(page: Page):
    open_results(page)
    expect(page.get_by_test_id("caught-line")).to_have_count(len(CATALOG["bugs"]))
    expect(page.get_by_test_id("caught-line").first).to_contain_text("caught by")
