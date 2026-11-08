"""Shared test setup.

Run against a local copy:   npm run dev   then   pytest --base-url http://localhost:8888
Run against Netlify:        pytest --base-url https://nataliakrasnova.netlify.app
Run with planted bugs:      pytest --base-url ... --bug-mode
Only one layer:             pytest -m api      (or ui, evals, a11y, smoke)

Every test starts from fresh demo data: Rostr keeps each visitor's data in their own cookie,
so a new browser context or a new requests.Session is a brand-new copy of the team.
"""
from urllib.parse import urlparse

import pytest

from support.api_client import RostrApi

DEMO_EMAIL = "manager@rostr.demo"
DEMO_PASSWORD = "password"


def pytest_addoption(parser):
    parser.addoption(
        "--bug-mode",
        action="store_true",
        default=False,
        help="Turn on Rostr's planted bugs (sets the bug_mode cookie).",
    )


def pytest_collection_modifyitems(items):
    """Tag tests by folder so `-m ui` / `-m api` work without decorating every test."""
    for item in items:
        path = item.path.as_posix()
        for layer in ("ui", "api", "evals", "a11y"):
            if f"/tests/{layer}/" in path:
                item.add_marker(getattr(pytest.mark, layer))


@pytest.fixture(scope="session")
def bug_mode(pytestconfig) -> bool:
    return pytestconfig.getoption("--bug-mode")


@pytest.fixture
def context(context, base_url, bug_mode):
    """Every browser test gets the bug_mode cookie that matches the run."""
    if base_url:
        context.add_cookies(
            [{"name": "bug_mode", "value": "on" if bug_mode else "off", "domain": urlparse(base_url).hostname, "path": "/"}]
        )
    return context


@pytest.fixture
def api(base_url, bug_mode) -> RostrApi:
    """An API client that is NOT signed in yet."""
    return RostrApi(base_url, bug_mode=bug_mode)


@pytest.fixture
def signed_in_api(api) -> RostrApi:
    """An API client signed in as the demo manager, with fresh demo data."""
    api.login(DEMO_EMAIL, DEMO_PASSWORD).raise_for_status()
    return api


@pytest.fixture
def rostr(page):
    """The Rostr app, opened (visitors are signed in automatically) with fresh demo data."""
    from pages.rostr_app import RostrApp

    app = RostrApp(page).open()
    app.wait_until_signed_in()
    return app
