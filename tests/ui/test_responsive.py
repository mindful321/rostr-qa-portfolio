"""Phone and tablet sizes: the demo must stay usable without sideways scrolling."""
import pytest
from playwright.sync_api import Page, expect

from conftest import DEMO_EMAIL, DEMO_PASSWORD
from pages.rostr_app import RostrApp

SCREENS = {"iphone-13": (390, 844), "pixel-7": (412, 915), "ipad-mini": (768, 1024)}


@pytest.mark.parametrize("screen", SCREENS.keys())
@pytest.mark.parametrize("path", ["/", "/demo"])
def test_no_horizontal_scroll(page: Page, screen, path):
    width, height = SCREENS[screen]
    page.set_viewport_size({"width": width, "height": height})
    page.goto(path)
    page.wait_for_load_state("networkidle")
    overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    assert overflow <= 0, f"{path} scrolls sideways by {overflow}px on {screen}"


@pytest.mark.parametrize("screen", ["iphone-13", "pixel-7"])
def test_phone_user_can_sign_in_and_switch_tabs(page: Page, screen):
    page.set_viewport_size(dict(zip(("width", "height"), SCREENS[screen])))
    app = RostrApp(page).open()
    app.login_page.sign_in(DEMO_EMAIL, DEMO_PASSWORD)
    app.wait_until_signed_in()
    app.go_to("timesheet")
    expect(app.timesheet.total).to_be_visible()
