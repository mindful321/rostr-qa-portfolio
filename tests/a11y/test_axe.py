"""Accessibility: an axe-core scan of every page and every Rostr screen (WCAG 2.1 A and AA rules)."""
import pytest
from axe_playwright_python.sync_playwright import Axe
from playwright.sync_api import Page

from conftest import DEMO_EMAIL, DEMO_PASSWORD
from pages.rostr_app import RostrApp

AXE = Axe()
WCAG = {"runOnly": {"type": "tag", "values": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]}}


def assert_no_violations(page: Page, where: str):
    results = AXE.run(page, options=WCAG)
    problems = [
        f"{v['id']} ({v['impact']}): {v['help']} -> {[n['target'] for n in v['nodes']][:3]}"
        for v in results.response["violations"]
    ]
    assert not problems, f"Accessibility problems on {where}:\n" + "\n".join(problems)


@pytest.mark.parametrize("path", ["/", "/results"])
def test_static_pages(page: Page, path):
    page.goto(path)
    assert_no_violations(page, path)


def test_rostr_login_screen(page: Page):
    RostrApp(page).open_login()
    assert_no_violations(page, "Rostr login")


@pytest.mark.parametrize("screen", ["schedule", "timeoff", "timesheet", "assistant"])
def test_rostr_screens(page: Page, screen):
    app = RostrApp(page).open()
    app.wait_until_signed_in()
    app.go_to(screen)
    page.wait_for_load_state("networkidle")
    assert_no_violations(page, f"Rostr {screen}")
