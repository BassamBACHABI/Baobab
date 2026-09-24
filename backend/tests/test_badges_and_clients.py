"""Iteration 6: Admin Clients bug fix + Badges (/me/badges, /admin/badges, /me/support/seen) + ClientHome due."""
import os
import time
import pytest
import requests

def _get_base():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    # Fallback: read from frontend .env (test env doesn't inherit React vars)
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE = _get_base()
API = f"{BASE}/api"

ADMIN = ("bachabi.bassam@gmail.com", "Admin#Baobab2026")
OPERATOR = ("operator@baobabcargo.app", "Operator#2026")
AWA = ("awa@example.com", "Client#2026")
KOFFI = ("koffi@example.com", "Client#2026")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def tokens():
    return {
        "admin": _login(*ADMIN),
        "operator": _login(*OPERATOR),
        "awa": _login(*AWA),
        "koffi": _login(*KOFFI),
    }


# ------------ Admin Clients (bug fix) ------------
class TestAdminClients:
    def test_admin_clients_not_empty(self, tokens):
        r = requests.get(f"{API}/admin/clients", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 2, f"expected clients, got {len(data)}"
        emails = {c.get("email") for c in data}
        assert "awa@example.com" in emails
        assert "koffi@example.com" in emails
        # customer_reference should be CLB-XXXXXX
        awa = next(c for c in data if c["email"] == "awa@example.com")
        assert awa.get("customer_reference", "").startswith("CLB-")
        assert "_id" not in awa  # serialize should strip

    def test_admin_clients_requires_auth(self):
        r = requests.get(f"{API}/admin/clients", timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_clients_client_forbidden(self, tokens):
        r = requests.get(f"{API}/admin/clients", headers=_h(tokens["awa"]), timeout=15)
        assert r.status_code == 403


# ------------ /me/badges ------------
class TestMeBadges:
    def test_me_badges_requires_auth(self):
        r = requests.get(f"{API}/me/badges", timeout=15)
        assert r.status_code == 401

    def test_me_badges_shape(self, tokens):
        r = requests.get(f"{API}/me/badges", headers=_h(tokens["awa"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "support" in d and "proxy" in d
        assert isinstance(d["support"], int) and isinstance(d["proxy"], int)

    def test_client_support_badge_flow(self, tokens):
        # 1. CLIENT posts a message
        r = requests.post(f"{API}/me/support/messages",
                          headers=_h(tokens["awa"]),
                          json={"body": "TEST_BADGE_" + str(int(time.time()))}, timeout=15)
        assert r.status_code == 200
        # 2. Mark seen so we start from a clean slate
        r = requests.post(f"{API}/me/support/seen", headers=_h(tokens["awa"]), timeout=15)
        assert r.status_code == 200
        # 3. Fetch badges after seen — support should be 0
        r = requests.get(f"{API}/me/badges", headers=_h(tokens["awa"]), timeout=15)
        assert r.status_code == 200
        before = r.json()["support"]
        # 4. ADMIN replies
        r = requests.post(f"{API}/admin/support/threads/{_user_id(tokens['awa'])}",
                          headers=_h(tokens["admin"]),
                          json={"body": "TEST_REPLY_BADGE_" + str(int(time.time()))}, timeout=15)
        assert r.status_code == 200
        # 5. Client badge should have +1
        r = requests.get(f"{API}/me/badges", headers=_h(tokens["awa"]), timeout=15)
        after = r.json()["support"]
        assert after >= before + 1, f"expected support badge to increase, was {before}, now {after}"
        # 6. POST /me/support/seen resets on next fetch
        r = requests.post(f"{API}/me/support/seen", headers=_h(tokens["awa"]), timeout=15)
        assert r.status_code == 200
        r = requests.get(f"{API}/me/badges", headers=_h(tokens["awa"]), timeout=15)
        assert r.json()["support"] == 0


def _user_id(tok):
    r = requests.get(f"{API}/auth/me", headers=_h(tok), timeout=15)
    return r.json()["id"]


# ------------ /admin/badges ------------
class TestAdminBadges:
    def test_admin_badges_client_forbidden(self, tokens):
        r = requests.get(f"{API}/admin/badges", headers=_h(tokens["awa"]), timeout=15)
        assert r.status_code == 403

    def test_admin_badges_shape(self, tokens):
        r = requests.get(f"{API}/admin/badges", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "support" in d and "proxy" in d

    def test_operator_proxy_is_zero(self, tokens):
        r = requests.get(f"{API}/admin/badges", headers=_h(tokens["operator"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["proxy"] == 0

    def test_admin_support_badge_reflects_client_msg(self, tokens):
        # Client posts msg -> becomes latest for that user_id -> admin support badge >=1
        requests.post(f"{API}/me/support/messages",
                      headers=_h(tokens["koffi"]),
                      json={"body": "TEST_ADMIN_BADGE_" + str(int(time.time()))}, timeout=15)
        r = requests.get(f"{API}/admin/badges", headers=_h(tokens["admin"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["support"] >= 1
