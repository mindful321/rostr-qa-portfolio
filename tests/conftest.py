"""Shared test setup.

Run against a local copy:   pytest --base-url http://localhost:8888
Run against Netlify:        pytest --base-url https://nataliakrasnova.netlify.app
Run with planted bugs:      pytest --base-url ... --bug-mode
"""
from urllib.parse import urlparse

import pytest


def pytest_addoption(parser):
    parser.addoption(
        "--bug-mode",
        action="store_true",
        default=False,
        help="Turn on Rostr's planted bugs (sets the bug_mode cookie).",
    )


@pytest.fixture(scope="session")
def bug_mode(pytestconfig) -> bool:
    return pytestconfig.getoption("--bug-mode")


@pytest.fixture
def context(context, base_url, bug_mode):
    """Every browser test gets the bug_mode cookie that matches the run."""
    if base_url:
        host = urlparse(base_url).hostname
        context.add_cookies(
            [{"name": "bug_mode", "value": "on" if bug_mode else "off", "domain": host, "path": "/"}]
        )
    return context
