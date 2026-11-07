"""Auth API: login, logout, session checks, and a tampered cookie."""
import pytest

from conftest import DEMO_EMAIL, DEMO_PASSWORD


def test_login_returns_user_and_sets_an_httponly_session_cookie(api):
    r = api.login(DEMO_EMAIL, DEMO_PASSWORD)
    assert r.status_code == 200
    assert r.json() == {"user": {"email": DEMO_EMAIL, "name": "Manager"}}
    cookie = r.headers["set-cookie"]
    assert cookie.startswith("rostr_session=")
    assert "HttpOnly" in cookie and "SameSite=Lax" in cookie


def test_email_is_not_case_sensitive(api):
    assert api.login("Manager@Rostr.Demo", DEMO_PASSWORD).status_code == 200


@pytest.mark.parametrize(
    "email, password",
    [(DEMO_EMAIL, "nope"), ("nobody@rostr.demo", DEMO_PASSWORD), (DEMO_EMAIL, "PASSWORD"), (DEMO_EMAIL, " password")],
    ids=["wrong-password", "unknown-user", "wrong-case", "leading-space"],
)
def test_bad_credentials_get_401_without_leaking_which_part_was_wrong(api, email, password):
    r = api.login(email, password)
    assert r.status_code == 401
    assert r.json()["error"] == {"code": "invalid_credentials", "message": "Incorrect email or password."}
    assert "set-cookie" not in r.headers


@pytest.mark.parametrize(
    "body",
    [{}, {"email": DEMO_EMAIL}, {"password": DEMO_PASSWORD}, {"email": "", "password": ""}, {"email": 123, "password": True}],
    ids=["empty", "no-password", "no-email", "blank", "wrong-types"],
)
def test_missing_or_malformed_fields_get_400(api, body):
    r = api.post("/auth/login", body)
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "missing_fields"


def test_login_with_get_is_not_allowed(api):
    r = api.get("/auth/login")
    assert r.status_code == 405
    assert r.headers["allow"] == "POST"


def test_me_without_session_is_401(api):
    assert api.me().status_code == 401


def test_me_with_session_returns_the_user(signed_in_api):
    r = signed_in_api.me()
    assert r.status_code == 200
    assert r.json()["user"]["email"] == DEMO_EMAIL


def test_logout_ends_the_session(signed_in_api):
    assert signed_in_api.logout().status_code == 204
    assert signed_in_api.me().status_code == 401


def test_tampered_session_cookie_is_rejected(signed_in_api):
    jar = signed_in_api.session.cookies
    value = jar.get("rostr_session")
    payload, signature = value.split(".")
    # Flip one character of the signature: the server must notice.
    forged = f"{payload}.{'A' if signature[0] != 'A' else 'B'}{signature[1:]}"
    jar.set("rostr_session", forged)
    assert signed_in_api.me().status_code == 401


def test_unknown_auth_action_is_404(api):
    assert api.post("/auth/hack").status_code == 404
