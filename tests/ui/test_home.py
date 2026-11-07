"""Starter smoke tests for the home page. More to come as the site grows."""
import re

from playwright.sync_api import Page, expect

from pages.home_page import HomePage


def test_home_page_loads_with_headline(page: Page):
    home = HomePage(page).open()
    expect(page).to_have_title(re.compile("Natalia Krasnova"))
    expect(home.hero_title).to_contain_text("before your users do")


def test_demo_link_opens_demo_page(page: Page):
    home = HomePage(page).open()
    home.nav_demo.click()
    expect(page).to_have_url(re.compile(r"/demo(\.html)?$"))


def test_contact_email_is_a_mailto_link(page: Page):
    home = HomePage(page).open()
    expect(home.contact_email).to_have_attribute("href", "mailto:krasnova.natalia@outlook.com")


def test_resume_pdf_link_works(page: Page, base_url):
    home = HomePage(page).open()
    href = page.get_by_test_id("link-resume").get_attribute("href")
    response = page.request.get(f"{base_url}/{href}")
    assert response.ok, f"Resume link is broken: {response.status}"
    assert response.headers["content-type"].startswith("application/pdf")


def test_linkedin_link_points_to_profile(page: Page):
    HomePage(page).open()
    expect(page.get_by_test_id("link-linkedin")).to_have_attribute(
        "href", "https://www.linkedin.com/in/nataliakrasnova/"
    )


def test_experience_lists_three_companies(page: Page):
    home = HomePage(page).open()
    expect(home.experience.locator("article")).to_have_count(3)


def test_no_horizontal_scroll_on_phone(page: Page):
    page.set_viewport_size({"width": 375, "height": 812})
    HomePage(page).open()
    overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    assert overflow <= 0, f"Page scrolls sideways by {overflow}px on a phone"
