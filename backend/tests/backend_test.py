"""Baobab Cargo — Backend integration tests (pytest)

Covers: auth (register/login/me), per-user isolation, RBAC via user_roles,
reference data + Decimal128 as strings, weigh/volumetric, status transitions,
shipments creation & tracking, payments (client PENDING forcing + XOR),
Google session endpoint smoke.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://europe-benin-log.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("bachabi.bassam@gmail.com", "Admin#Baobab2026")
OPERATOR = ("operator@baobabcargo.app", "Operator#2026")
AWA = ("awa@example.com", "Client#2026")
KOFFI = ("koffi@example.com", "Client#2026")


# ---- helpers ----
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def admin_token():
    return _login(*ADMIN)


@pytest.fixture(scope="session")
def operator_token():
    return _login(*OPERATOR)


@pytest.fixture(scope="session")
def awa_token():
    return _login(*AWA)


@pytest.fixture(scope="session")
def koffi_token():
    return _login(*KOFFI)


# ---- AUTH ----
class TestAuth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": AWA[0], "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_client(self, awa_token):
        r = requests.get(f"{API}/auth/me", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == AWA[0]
        assert "CLIENT" in u["roles"]

    def test_me_admin_roles(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert "ADMIN" in r.json()["roles"]

    def test_register_public_is_client_and_forwarding_created(self):
        email = f"test_{uuid.uuid4().hex[:10]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Password#123",
            "first_name": "T", "last_name": "U"
        }, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == email
        assert data["user"]["roles"] == ["CLIENT"]
        tok = data["access_token"]

        # forwarding address auto-created with CLB-XXXXXX
        r2 = requests.get(f"{API}/me/forwarding-address", headers=_h(tok), timeout=15)
        assert r2.status_code == 200
        fwd = r2.json()
        assert len(fwd) >= 1
        ref = fwd[0]["customer_reference"]
        assert ref.startswith("CLB-") and len(ref) == 10, f"bad ref {ref}"

        # duplicate email -> 409
        r3 = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Password#123"
        }, timeout=15)
        assert r3.status_code == 409, r3.text

    def test_google_session_missing_id(self):
        r = requests.post(f"{API}/auth/google/session", json={}, timeout=15)
        assert r.status_code == 400

    def test_google_session_invalid_id(self):
        r = requests.post(f"{API}/auth/google/session",
                          json={"session_id": "bogus-invalid"}, timeout=20)
        assert r.status_code == 401


# ---- ISOLATION ----
class TestIsolation:
    def test_awa_sees_one_package(self, awa_token):
        r = requests.get(f"{API}/me/packages", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200
        pkgs = r.json()
        assert len(pkgs) == 1, f"awa should see 1 pkg, saw {len(pkgs)}"

    def test_koffi_sees_zero_packages(self, koffi_token):
        r = requests.get(f"{API}/me/packages", headers=_h(koffi_token), timeout=15)
        assert r.status_code == 200
        assert r.json() == []

    def test_client_cannot_read_other_client_package(self, awa_token, koffi_token):
        r = requests.get(f"{API}/me/packages", headers=_h(awa_token), timeout=15)
        pid = r.json()[0]["id"]
        # koffi tries via /me/packages/{id} -> 404
        r2 = requests.get(f"{API}/me/packages/{pid}", headers=_h(koffi_token), timeout=15)
        assert r2.status_code == 404


# ---- RBAC ----
class TestRBAC:
    def test_client_cannot_access_admin(self, awa_token):
        for path in ("/admin/packages", "/admin/payments", "/admin/cost-records",
                     "/admin/shipments", "/admin/clients"):
            r = requests.get(f"{API}{path}", headers=_h(awa_token), timeout=15)
            assert r.status_code == 403, f"{path} expected 403 got {r.status_code}"

    def test_operator_packages_ok_payments_forbidden(self, operator_token):
        r = requests.get(f"{API}/admin/packages", headers=_h(operator_token), timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/admin/payments", headers=_h(operator_token), timeout=15)
        assert r2.status_code == 403
        r3 = requests.get(f"{API}/admin/cost-records", headers=_h(operator_token), timeout=15)
        assert r3.status_code == 403
        # operator forbidden on shipments per credentials doc
        r4 = requests.get(f"{API}/admin/shipments", headers=_h(operator_token), timeout=15)
        assert r4.status_code == 403

    def test_admin_full_access(self, admin_token):
        for path in ("/admin/packages", "/admin/payments", "/admin/cost-records",
                     "/admin/shipments", "/admin/clients"):
            r = requests.get(f"{API}{path}", headers=_h(admin_token), timeout=15)
            assert r.status_code == 200, f"{path} {r.status_code}"


# ---- REFERENCE / DECIMALS ----
class TestReference:
    def test_countries(self, awa_token):
        r = requests.get(f"{API}/countries", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200
        codes = {c["code"] for c in r.json()}
        assert {"FR", "BJ"}.issubset(codes)

    def test_hubs(self, awa_token):
        r = requests.get(f"{API}/hubs", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200
        names = [h["name"] for h in r.json()]
        assert any("Lille" in n for n in names)

    def test_carriers(self, awa_token):
        r = requests.get(f"{API}/carriers", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200
        assert any("Baobab" in c["name"] for c in r.json())

    def test_delivery_zones(self, awa_token):
        r = requests.get(f"{API}/delivery-zones", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200
        zones = r.json()
        assert len(zones) >= 2
        # money as string
        for z in zones:
            assert isinstance(z["fee_xof"], str)

    def test_tariffs(self, awa_token):
        r = requests.get(f"{API}/tariffs", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200
        tariffs = r.json()
        assert len(tariffs) >= 4
        for t in tariffs:
            for f in ("min_weight_kg", "max_weight_kg", "price_per_kg", "fixed_fee"):
                assert isinstance(t[f], str), f"{f} must be string, got {type(t[f])}"

    def test_settings(self, awa_token):
        r = requests.get(f"{API}/settings", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200
        d = {s["key"]: s["value"] for s in r.json()}
        assert "eur_xof_rate" in d and "volumetric_divisor" in d and "storage_free_days" in d
        # 655.957 stored — accept string or numeric
        assert str(d["eur_xof_rate"]).startswith("655.957") or float(d["eur_xof_rate"]) == 655.957
        assert int(d["volumetric_divisor"]) == 5000
        assert int(d["storage_free_days"]) == 14


# ---- PACKAGE flow (create/weigh/transitions) ----
class TestPackageFlow:
    @pytest.fixture(scope="class")
    def awa_ref(self, awa_token):
        r = requests.get(f"{API}/me/forwarding-address", headers=_h(awa_token), timeout=15)
        return r.json()[0]["customer_reference"]

    def test_create_weigh_transitions(self, admin_token, awa_ref):
        # Create package attached to awa via customer_reference
        r = requests.post(f"{API}/admin/packages", headers=_h(admin_token), json={
            "customer_reference": awa_ref,
            "merchant_name": "TEST_Merchant",
            "notes": "TEST_pkg"
        }, timeout=15)
        assert r.status_code == 200, r.text
        pkg = r.json()
        pid = pkg["id"]
        assert pkg["status"] == "RECEIVED"
        assert pkg["user_id"] is not None

        # Weigh — expect 4.80 both fields
        r2 = requests.put(f"{API}/admin/packages/{pid}/weigh",
                          headers=_h(admin_token),
                          json={"weight_kg": 3.2, "length_cm": 40, "width_cm": 30, "height_cm": 20},
                          timeout=15)
        assert r2.status_code == 200, r2.text
        w = r2.json()
        assert w["volumetric_weight_kg"] == "4.80", w["volumetric_weight_kg"]
        assert w["billable_weight_kg"] == "4.80", w["billable_weight_kg"]

        # Transitions RECEIVED -> INSPECTED -> STORED -> READY_TO_SHIP
        for to in ("INSPECTED", "STORED", "READY_TO_SHIP"):
            r3 = requests.post(f"{API}/admin/packages/{pid}/transition",
                               headers=_h(admin_token),
                               json={"to_status": to, "reason": "test"}, timeout=15)
            assert r3.status_code == 200, f"{to}: {r3.status_code} {r3.text}"

        # Illegal: READY_TO_SHIP -> DELIVERED -> 409
        r4 = requests.post(f"{API}/admin/packages/{pid}/transition",
                           headers=_h(admin_token),
                           json={"to_status": "DELIVERED"}, timeout=15)
        assert r4.status_code == 409, r4.text

        # status_history has entries — verify via reference/enums? Not exposed; use admin list not exposed.
        # skip DB probe (kept simple)

        # keep pid for shipment tests
        TestPackageFlow._pid = pid  # type: ignore


# ---- SHIPMENT flow ----
class TestShipmentFlow:
    def test_shipment_lifecycle(self, admin_token, awa_token):
        pid = getattr(TestPackageFlow, "_pid", None)
        assert pid, "package fixture missing"

        r = requests.post(f"{API}/admin/shipments", headers=_h(admin_token), json={
            "package_ids": [pid],
            "destination_country_code": "BJ",
            "destination_city": "Cotonou",
            "delivery_mode": "PICKUP_POINT",
            "transport_mode": "AIR",
        }, timeout=20)
        assert r.status_code == 200, r.text
        ship = r.json()
        sid = ship["id"]
        assert ship["status"] == "DRAFT"
        assert ship["total_billable_weight_kg"] == "4.80"

        # Add a tracking event
        r2 = requests.post(f"{API}/admin/shipments/{sid}/tracking",
                           headers=_h(admin_token),
                           json={"status": "IN_TRANSIT", "location": "CDG",
                                 "message": "Envolé"}, timeout=15)
        assert r2.status_code == 200, r2.text

        # Client (awa owns the pkg) can read own shipment tracking
        r3 = requests.get(f"{API}/me/shipments/{sid}/tracking",
                          headers=_h(awa_token), timeout=15)
        assert r3.status_code == 200
        assert len(r3.json()) >= 1

        TestShipmentFlow._sid = sid  # type: ignore


# ---- PAYMENTS ----
class TestPayments:
    def test_client_payment_forced_pending(self, awa_token):
        sid = getattr(TestShipmentFlow, "_sid", None)
        assert sid, "shipment fixture missing"
        r = requests.post(f"{API}/me/payments", headers=_h(awa_token), json={
            "shipment_id": sid, "provider": "MANUAL",
            "amount": 1000, "currency": "XOF"
        }, timeout=15)
        assert r.status_code == 200, r.text
        pay = r.json()
        assert pay["status"] == "PENDING"
        assert pay["paid_at"] is None
        assert isinstance(pay["amount"], str)
        TestPayments._pay_id = pay["id"]  # type: ignore

    def test_payment_xor_validation(self, awa_token):
        # both shipment_id and order_id -> 422
        r = requests.post(f"{API}/me/payments", headers=_h(awa_token), json={
            "shipment_id": "aaaaaaaaaaaaaaaaaaaaaaaa",
            "order_id": "bbbbbbbbbbbbbbbbbbbbbbbb",
            "amount": 100
        }, timeout=15)
        assert r.status_code == 422, r.text

    def test_admin_transition_to_paid(self, admin_token):
        pid = getattr(TestPayments, "_pay_id", None)
        assert pid
        r = requests.post(f"{API}/admin/payments/{pid}/transition",
                          headers=_h(admin_token),
                          json={"to_status": "PAID"}, timeout=15)
        assert r.status_code == 200, r.text
        pay = r.json()
        assert pay["status"] == "PAID"
        assert pay["paid_at"] is not None
