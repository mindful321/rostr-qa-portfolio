"""API smoke tests: prove the API is up and auth works. Run alone with: pytest -m smoke"""
import pytest
import requests

pytestmark = pytest.mark.smoke

DEMO_LOGIN = {"email": "manager@rostr.demo", "password": "password"}


def test_health_is_ok(base_url):
    r = requests.get(f"{base_url}/api/v1/health", timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_schedule_requires_sign_in(base_url):
    r = requests.get(f"{base_url}/api/v1/shifts", timeout=10)
    assert r.status_code == 401


def test_sign_in_then_read_schedule(base_url):
    s = requests.Session()
    login = s.post(f"{base_url}/api/v1/auth/login", json=DEMO_LOGIN, timeout=10)
    assert login.status_code == 200
    schedule = s.get(f"{base_url}/api/v1/shifts", timeout=10)
    assert schedule.status_code == 200
    assert [e["id"] for e in schedule.json()["employees"]] == ["maria", "dev", "aisha"]
