"""Page object for the portfolio home page."""
from playwright.sync_api import Page


class HomePage:
    def __init__(self, page: Page):
        self.page = page
        self.hero_title = page.get_by_test_id("hero-title")
        self.nav_demo = page.get_by_test_id("nav-demo")
        self.nav_results = page.get_by_test_id("nav-results")
        self.cta_demo = page.get_by_test_id("cta-demo")
        self.contact_email = page.get_by_test_id("contact-email")
        self.experience = page.get_by_test_id("experience")

    def open(self):
        self.page.goto("/")
        return self
