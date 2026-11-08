"""Login and sign-out through the UI."""
import pytest
from playwright.sync_api import Page, expect

from conftest import DEMO_EMAIL, DEMO_PASSWORD
from pages.rostr_app import RostrApp


def test_demo_opens_already_signed_in(page: Page):
    app = RostrApp(page).open()
    expect(app.schedule.table).to_be_visible()
    expect(app.login_page.form).to_have_count(0)


def test_valid_login_opens_schedule(page: Page):
    app = RostrApp(page).open_login()
    app.login_page.sign_in(DEMO_EMAIL, DEMO_PASSWORD)
    expect(app.schedule.table).to_be_visible()
    expect(app.url_bar).to_have_text("rostr.demo/schedule")


@pytest.mark.parametrize(
    "email, password",
    [
        (DEMO_EMAIL, "wrong-password"),
        ("someone@else.demo", DEMO_PASSWORD),
        (DEMO_EMAIL, "PASSWORD"),  # passwords are case-sensitive
    ],
    ids=["wrong-password", "unknown-email", "wrong-case"],
)
def test_bad_credentials_are_rejected(page: Page, email, password):
    app = RostrApp(page).open_login()
    app.login_page.sign_in(email, password)
    expect(app.login_page.error).to_have_text("Incorrect email or password.")
    expect(app.schedule.table).to_be_hidden()


def test_empty_password_shows_an_error(page: Page):
    app = RostrApp(page).open_login()
    app.login_page.sign_in(DEMO_EMAIL, "")
    expect(app.login_page.error).to_be_visible()
    expect(app.schedule.table).to_be_hidden()


def test_sign_out_returns_to_login_and_stays_signed_out(rostr):
    """After Sign out, a reload must NOT sign the visitor back in automatically."""
    rostr.sign_out()
    rostr.page.reload()
    expect(rostr.login_page.form).to_be_visible()


def test_signing_in_again_after_sign_out(rostr):
    rostr.sign_out()
    rostr.login_page.sign_in(DEMO_EMAIL, DEMO_PASSWORD)
    expect(rostr.schedule.table).to_be_visible()


def test_session_survives_a_page_reload(rostr):
    rostr.page.reload()
    expect(rostr.schedule.table).to_be_visible()
