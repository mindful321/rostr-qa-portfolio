"""Page objects for the Rostr demo app (/demo). One class per screen, plus RostrApp to move between them.

Locators use data-testid attributes, so tests don't break when copy or styling changes.
"""
from playwright.sync_api import Locator, Page, expect


class LoginPage:
    def __init__(self, page: Page):
        self.page = page
        self.form = page.get_by_test_id("login-form")
        self.email = page.get_by_test_id("login-email")
        self.password = page.get_by_test_id("login-password")
        self.submit = page.get_by_test_id("login-submit")
        self.error = page.get_by_test_id("login-error")

    def sign_in(self, email: str, password: str):
        self.email.fill(email)
        self.password.fill(password)
        self.submit.click()


class SchedulePage:
    def __init__(self, page: Page):
        self.page = page
        self.table = page.get_by_test_id("schedule-table")
        self.day_headers = page.get_by_test_id("day-header")
        self.shifts = page.get_by_test_id("shift")
        self.quick_add_overlap = page.get_by_test_id("quick-add-overlap")
        self.notice_ok = page.get_by_test_id("notice-ok")
        self.notice_error = page.get_by_test_id("notice-error")

    def cell(self, employee_id: str, day: int) -> Locator:
        return self.page.get_by_test_id(f"cell-{employee_id}-{day}")

    def add_shift(self, employee: str, day: str, start: str, end: str):
        """employee and day are the visible labels, e.g. 'Dev P.' and 'Tue'."""
        self.page.get_by_test_id("shift-employee").select_option(label=employee)
        self.page.get_by_test_id("shift-day").select_option(label=day)
        self.page.get_by_test_id("shift-start").fill(start)
        self.page.get_by_test_id("shift-end").fill(end)
        self.page.get_by_test_id("shift-submit").click()


class TimeOffPage:
    def __init__(self, page: Page):
        self.page = page

    def approve(self, request_id: str):
        self.page.get_by_test_id(f"approve-{request_id}").click()

    def deny(self, request_id: str):
        self.page.get_by_test_id(f"deny-{request_id}").click()

    def approve_button(self, request_id: str) -> Locator:
        return self.page.get_by_test_id(f"approve-{request_id}")

    def status(self, request_id: str) -> Locator:
        return self.page.get_by_test_id(f"status-{request_id}")

    def balance(self, employee_id: str) -> Locator:
        return self.page.get_by_test_id(f"balance-{employee_id}")


class TimesheetPage:
    def __init__(self, page: Page):
        self.page = page
        self.table = page.get_by_test_id("payroll-table")
        self.total = page.get_by_test_id("pay-total")

    def hours(self, employee_id: str) -> Locator:
        return self.page.get_by_test_id(f"hours-{employee_id}")

    def overtime(self, employee_id: str) -> Locator:
        return self.page.get_by_test_id(f"ot-{employee_id}")

    def gross(self, employee_id: str) -> Locator:
        return self.page.get_by_test_id(f"gross-{employee_id}")


class AssistantPage:
    def __init__(self, page: Page):
        self.page = page
        self.input = page.get_by_test_id("ask-input")
        self.submit = page.get_by_test_id("ask-submit")
        self.answers = page.get_by_test_id("chat-answer")

    def suggestion(self, index: int) -> Locator:
        return self.page.get_by_test_id(f"suggestion-{index}")

    def ask(self, question: str):
        self.input.fill(question)
        self.submit.click()

    def last_answer(self) -> Locator:
        return self.answers.last


class RostrApp:
    def __init__(self, page: Page):
        self.page = page
        self.url_bar = page.get_by_test_id("rostr-url")
        self.netlog = page.get_by_test_id("netlog")
        self.sign_out_button = page.get_by_test_id("sign-out")
        self.reset_button = page.get_by_test_id("reset-data")
        self.login_page = LoginPage(page)
        self.schedule = SchedulePage(page)
        self.time_off = TimeOffPage(page)
        self.timesheet = TimesheetPage(page)
        self.assistant = AssistantPage(page)

    def open(self):
        self.page.goto("/demo")
        return self

    def wait_until_signed_in(self):
        expect(self.schedule.table).to_be_visible()

    def tab(self, name: str) -> Locator:
        return self.page.get_by_test_id(f"tab-{name}")

    def go_to(self, name: str):
        """name: schedule | timeoff | timesheet | assistant"""
        self.tab(name).click()
        expect(self.tab(name)).to_have_attribute("aria-selected", "true")

    def sign_out(self):
        self.sign_out_button.click()
        expect(self.login_page.form).to_be_visible()

    def reset_data(self):
        self.reset_button.click()
