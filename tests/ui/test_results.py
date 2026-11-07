"""Test results page: it must show a real release-gate result, not placeholders."""
import json
import re
from pathlib import Path

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
