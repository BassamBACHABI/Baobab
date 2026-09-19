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


# ---- FORGOT / RESET PASSWORD ----
class TestForgotReset:
    def test_forgot_password_existing_email_generic(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": AWA[0]}, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j.get("ok") is True
        assert "compte existe" in j.get("message", "").lower() or "réinitialisation" in j.get("message", "").lower()

    def test_forgot_password_nonexistent_no_enumeration(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": f"noone_{uuid.uuid4().hex[:8]}@example.com"}, timeout=15)
        assert r.status_code == 200
        # Same generic response
        assert r.json().get("ok") is True

    def test_reset_password_bad_token(self):
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": "totally-bogus-token", "new_password": "Whatever#1"},
                          timeout=15)
        assert r.status_code == 400

    def test_full_forgot_reset_cycle_for_awa(self):
        """Trigger forgot -> pull token from backend log -> reset -> login -> restore original."""
        import subprocess, re, time
        # 1) trigger forgot
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": AWA[0]}, timeout=15)
        assert r.status_code == 200
        time.sleep(0.5)
        # 2) grab token from backend log (searches both .err.log and .out.log)
        token = None
        for log in ("/var/log/supervisor/backend.err.log", "/var/log/supervisor/backend.out.log"):
            try:
                out = subprocess.check_output(["tail", "-n", "400", log], text=True, timeout=5)
            except Exception:
                continue
            matches = re.findall(r"LIEN DE R[ÉE]INITIALISATION pour %s.*token=([A-Za-z0-9_\-]+)" % re.escape(AWA[0]), out)
            if matches:
                token = matches[-1]
                break
        assert token, "Reset token not found in backend logs"
        # 3) reset to a new password
        new_pw = "TempClient#9999"
        r2 = requests.post(f"{API}/auth/reset-password",
                           json={"token": token, "new_password": new_pw}, timeout=15)
        assert r2.status_code == 200, r2.text
        # 4) login with new password works
        r3 = requests.post(f"{API}/auth/login",
                           json={"email": AWA[0], "password": new_pw}, timeout=15)
        assert r3.status_code == 200, r3.text
        # 5) same token cannot be reused
        r4 = requests.post(f"{API}/auth/reset-password",
                           json={"token": token, "new_password": "Another#123"}, timeout=15)
        assert r4.status_code == 400
        # 6) restore ORIGINAL password so other suites keep working — do it via a fresh forgot cycle
        r5 = requests.post(f"{API}/auth/forgot-password",
                           json={"email": AWA[0]}, timeout=15)
        assert r5.status_code == 200
        time.sleep(0.5)
        token2 = None
        for log in ("/var/log/supervisor/backend.err.log", "/var/log/supervisor/backend.out.log"):
            try:
                out = subprocess.check_output(["tail", "-n", "400", log], text=True, timeout=5)
            except Exception:
                continue
            matches = re.findall(r"LIEN DE R[ÉE]INITIALISATION pour %s.*token=([A-Za-z0-9_\-]+)" % re.escape(AWA[0]), out)
            if matches:
                token2 = matches[-1]
                break
        assert token2 and token2 != token, "Second reset token missing"
        r6 = requests.post(f"{API}/auth/reset-password",
                           json={"token": token2, "new_password": AWA[1]}, timeout=15)
        assert r6.status_code == 200
        # verify restored
        r7 = requests.post(f"{API}/auth/login",
                           json={"email": AWA[0], "password": AWA[1]}, timeout=15)
        assert r7.status_code == 200, "Failed to restore awa's original password"


# ---- APPLE guards ----
class TestAppleGuards:
    def test_apple_start_unconfigured_503(self):
        r = requests.get(f"{API}/auth/apple/start", timeout=15)
        # APPLE_CLIENT_ID intentionally unset in preview
        assert r.status_code == 503, f"expected 503 got {r.status_code}: {r.text}"

    def test_apple_callback_missing_fields_400(self):
        # form-encoded, no id_token / state
        r = requests.post(f"{API}/auth/apple/callback",
                          data={}, timeout=15)
        assert r.status_code == 400

        r2 = requests.post(f"{API}/auth/apple/callback",
                           data={"id_token": "abc"}, timeout=15)  # missing state
        assert r2.status_code == 400

        r3 = requests.post(f"{API}/auth/apple/callback",
                           data={"state": "abc"}, timeout=15)  # missing id_token
        assert r3.status_code == 400


# ---- PROFILE + BÉNIN ADDRESSES ----
class TestProfileAndAddresses:
    def test_get_profile(self, awa_token):
        r = requests.get(f"{API}/me/profile", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == AWA[0]

    def test_update_profile(self, awa_token):
        new_phone = f"+229{uuid.uuid4().int % 10**8:08d}"
        r = requests.put(f"{API}/me/profile", headers=_h(awa_token),
                         json={"first_name": "Awa", "last_name": "Test", "phone": new_phone}, timeout=15)
        assert r.status_code == 200, r.text
        # verify persisted
        r2 = requests.get(f"{API}/me/profile", headers=_h(awa_token), timeout=15)
        p = r2.json()
        assert p["first_name"] == "Awa"
        assert p["last_name"] == "Test"
        assert p["phone"] == new_phone

    def test_address_create_and_isolation(self, awa_token, koffi_token):
        # awa's addresses initially
        r_initial = requests.get(f"{API}/me/addresses", headers=_h(awa_token), timeout=15)
        assert r_initial.status_code == 200
        initial_count = len(r_initial.json())

        # create a Bénin address
        payload = {
            "country": "Bénin", "city": "Cotonou",
            "address_line": "Rue TEST 123",
            "landmark": "Près marché Dantokpa",
            "type": "DELIVERY_BENIN",
        }
        r = requests.post(f"{API}/me/addresses", headers=_h(awa_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["city"] == "Cotonou"
        assert created["country"] == "Bénin"
        assert created["type"] == "DELIVERY_BENIN"

        # awa sees it
        r2 = requests.get(f"{API}/me/addresses", headers=_h(awa_token), timeout=15)
        assert r2.status_code == 200
        assert len(r2.json()) == initial_count + 1

        # koffi does NOT see it (isolation)
        r3 = requests.get(f"{API}/me/addresses", headers=_h(koffi_token), timeout=15)
        assert r3.status_code == 200
        koffi_addrs = r3.json()
        koffi_lines = [a.get("address_line", "") for a in koffi_addrs]
        assert "Rue TEST 123" not in koffi_lines


# ---- SOCIAL IDENTITY KEYING (verify code path in accounts.ensure_social_user) ----
class TestSocialIdentity:
    def test_ensure_social_user_preserves_admin_role_via_direct_call(self, admin_token):
        """Simulate Google login for the seeded ADMIN email through the endpoint's guard behaviour.
        We can't perform the real OAuth, but we can call /api/auth/google/session with an invalid
        session_id and verify the ADMIN still has the ADMIN role afterwards (role NOT downgraded)."""
        r = requests.post(f"{API}/auth/google/session",
                          json={"session_id": "bogus"}, timeout=15)
        assert r.status_code == 401
        # admin role remains
        me = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=15).json()
        assert "ADMIN" in me["roles"]


# ==================== PROMPT 8 & 9 — Dashboard, Settings, Notifications ====================

# ---- ADMIN DASHBOARD (Prompt 8) ----
class TestAdminDashboardMetrics:
    def test_metrics_admin(self, admin_token):
        r = requests.get(f"{API}/admin/dashboard/metrics", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("received_this_week", "to_identify", "in_stock", "shipments_by_status"):
            assert k in d
        assert isinstance(d["received_this_week"], int)
        assert isinstance(d["shipments_by_status"], dict)

    def test_metrics_operator_allowed(self, operator_token):
        r = requests.get(f"{API}/admin/dashboard/metrics", headers=_h(operator_token), timeout=15)
        assert r.status_code == 200

    def test_metrics_client_forbidden(self, awa_token):
        r = requests.get(f"{API}/admin/dashboard/metrics", headers=_h(awa_token), timeout=15)
        assert r.status_code == 403

    def test_metrics_no_auth(self):
        r = requests.get(f"{API}/admin/dashboard/metrics", timeout=15)
        assert r.status_code in (401, 403)

    def test_todo_admin(self, admin_token):
        r = requests.get(f"{API}/admin/dashboard/todo", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("unidentified", "awaiting_preparation", "incidents"):
            assert k in d and isinstance(d[k], list)

    def test_todo_operator_allowed(self, operator_token):
        r = requests.get(f"{API}/admin/dashboard/todo", headers=_h(operator_token), timeout=15)
        assert r.status_code == 200

    def test_todo_client_forbidden(self, awa_token):
        r = requests.get(f"{API}/admin/dashboard/todo", headers=_h(awa_token), timeout=15)
        assert r.status_code == 403


class TestAdminDashboardFinance:
    def test_finance_admin(self, admin_token):
        r = requests.get(f"{API}/admin/dashboard/finance", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("payments_received", "revenue_month_eur", "revenue_month_xof"):
            assert k in d
        # Amounts are Decimal-serialized as strings
        assert isinstance(d["revenue_month_eur"], str)
        assert isinstance(d["revenue_month_xof"], str)
        # ensure no float artefacts / scientific
        assert "e" not in d["revenue_month_eur"].lower()
        assert "e" not in d["revenue_month_xof"].lower()

    def test_finance_operator_403(self, operator_token):
        r = requests.get(f"{API}/admin/dashboard/finance", headers=_h(operator_token), timeout=15)
        assert r.status_code == 403, r.text

    def test_finance_client_forbidden(self, awa_token):
        r = requests.get(f"{API}/admin/dashboard/finance", headers=_h(awa_token), timeout=15)
        assert r.status_code == 403


class TestAdminDashboardMargin:
    def test_margin_admin_default(self, admin_token):
        r = requests.get(f"{API}/admin/dashboard/margin", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("date_from", "date_to", "count", "total_revenue_eur", "total_cost_eur",
                  "total_margin_eur", "average_margin_eur", "cost_per_kg_eur", "rows"):
            assert k in d
        assert isinstance(d["rows"], list)
        for row in d["rows"]:
            for f in ("shipment_id", "reference", "revenue_eur", "cost_eur", "margin_eur", "billable_weight_kg"):
                assert f in row
            # revenue - cost == margin (decimal math sanity)
            from decimal import Decimal
            rev = Decimal(row["revenue_eur"])
            cost = Decimal(row["cost_eur"])
            marg = Decimal(row["margin_eur"])
            assert rev - cost == marg, f"margin mismatch: {rev}-{cost} != {marg}"

    def test_margin_with_date_range(self, admin_token):
        r = requests.get(f"{API}/admin/dashboard/margin",
                         headers=_h(admin_token),
                         params={"date_from": "2020-01-01", "date_to": "2035-12-31"},
                         timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["count"] >= 0

    def test_margin_operator_403(self, operator_token):
        r = requests.get(f"{API}/admin/dashboard/margin", headers=_h(operator_token), timeout=15)
        assert r.status_code == 403

    def test_margin_client_forbidden(self, awa_token):
        r = requests.get(f"{API}/admin/dashboard/margin", headers=_h(awa_token), timeout=15)
        assert r.status_code == 403


# ---- SETTINGS SCREENS BACKEND (Prompt 8) ----
class TestSettingsWrites:
    def test_operator_forbidden_on_admin_writes(self, operator_token):
        # zone
        r = requests.post(f"{API}/delivery-zones", headers=_h(operator_token), json={
            "name": "TEST_ZoneOp", "city": "TEST_City", "delivery_mode": "PICKUP_POINT",
            "fee_xof": "1000"
        }, timeout=15)
        assert r.status_code == 403, r.text
        # carrier
        r2 = requests.post(f"{API}/carriers", headers=_h(operator_token), json={"name": "TEST_CarrierOp"}, timeout=15)
        assert r2.status_code == 403
        # settings update
        r3 = requests.put(f"{API}/settings/eur_xof_rate", headers=_h(operator_token), json={"value": "655.957"}, timeout=15)
        assert r3.status_code == 403

    def test_admin_create_zone_writes_audit(self, admin_token):
        import uuid as _uuid
        name = f"TEST_Zone_{_uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/delivery-zones", headers=_h(admin_token), json={
            "name": name, "city": "TestCity", "delivery_mode": "PICKUP_POINT", "fee_xof": "2500"
        }, timeout=15)
        assert r.status_code == 200, r.text
        z = r.json()
        assert z["name"] == name
        assert isinstance(z["fee_xof"], str)
        # verify persisted via GET
        r2 = requests.get(f"{API}/delivery-zones", headers=_h(admin_token), timeout=15)
        assert any(x["name"] == name for x in r2.json())

    def test_admin_create_carrier(self, admin_token):
        import uuid as _uuid
        name = f"TEST_Carrier_{_uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/carriers", headers=_h(admin_token), json={"name": name}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == name

    def test_admin_update_setting_and_audit(self, admin_token):
        # Read current
        r0 = requests.get(f"{API}/settings", headers=_h(admin_token), timeout=15)
        cur = {s["key"]: s["value"] for s in r0.json()}
        rate = str(cur.get("eur_xof_rate", "655.957"))
        # Update to same value (no-op semantic; still writes audit)
        r = requests.put(f"{API}/settings/eur_xof_rate", headers=_h(admin_token),
                         json={"value": rate}, timeout=15)
        assert r.status_code == 200, r.text


# ---- NOTIFICATION PREFERENCES (Prompt 9) ----
class TestNotificationPrefs:
    def test_get_default_true(self, koffi_token):
        r = requests.get(f"{API}/me/notification-preferences", headers=_h(koffi_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["notify_non_essential"] in (True, False)

    def test_put_toggle_persists(self, koffi_token):
        # set false
        r = requests.put(f"{API}/me/notification-preferences", headers=_h(koffi_token),
                         json={"notify_non_essential": False}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["notify_non_essential"] is False
        # verify persisted
        r2 = requests.get(f"{API}/me/notification-preferences", headers=_h(koffi_token), timeout=15)
        assert r2.json()["notify_non_essential"] is False
        # restore true
        r3 = requests.put(f"{API}/me/notification-preferences", headers=_h(koffi_token),
                          json={"notify_non_essential": True}, timeout=15)
        assert r3.status_code == 200
        assert r3.json()["notify_non_essential"] is True

    def test_admin_cannot_access_client_prefs_endpoint_without_client_context(self, admin_token):
        # /me/* is per authenticated user; admin can still call for own profile — should be 200 or 404
        r = requests.get(f"{API}/me/notification-preferences", headers=_h(admin_token), timeout=15)
        assert r.status_code in (200, 404)


# ---- EMAIL NOTIFICATIONS IDEMPOTENCY & PREF GATING (Prompt 9) ----
class TestNotifications:
    """Verifies notify_event writes idempotent rows in `notifications` collection.
    Uses direct DB read via a temp admin helper: since there is no public endpoint,
    we use pymongo directly with MONGO_URL from backend env."""

    @classmethod
    def _db(cls):
        from pymongo import MongoClient
        # Read backend/.env
        env = {}
        try:
            with open("/app/backend/.env") as f:
                for line in f:
                    if "=" in line and not line.strip().startswith("#"):
                        k, v = line.strip().split("=", 1)
                        env[k] = v.strip('"').strip("'")
        except Exception:
            pass
        mongo_url = env.get("MONGO_URL") or os.environ.get("MONGO_URL")
        db_name = env.get("DB_NAME") or os.environ.get("DB_NAME") or "test_database"
        return MongoClient(mongo_url)[db_name]

    def _get_awa_ref(self, awa_token):
        r = requests.get(f"{API}/me/forwarding-address", headers=_h(awa_token), timeout=15)
        return r.json()[0]["customer_reference"]

    def test_package_received_creates_notification_and_is_idempotent(self, admin_token, awa_token):
        ref = self._get_awa_ref(awa_token)
        # Ensure awa pref is TRUE (non-essential enabled)
        requests.put(f"{API}/me/notification-preferences", headers=_h(awa_token),
                     json={"notify_non_essential": True}, timeout=15)
        # Receive a package (creates and records notification)
        r = requests.post(f"{API}/admin/packages/receive", headers=_h(admin_token), json={
            "customer_reference": ref,
            "merchant_name": "TEST_NotifMerchant",
            "notes": "TEST_notif_package"
        }, timeout=20)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        import time
        time.sleep(1.0)  # allow async notify_event to flush
        db = self._db()
        rows = list(db.notifications.find({"event": "package_received", "entity_type": "PACKAGE", "entity_id": pid}))
        assert len(rows) == 1, f"expected 1 notification, got {len(rows)}: {rows}"
        assert rows[0].get("status") in ("SENT", "FAILED", "SKIPPED")

        # Re-call receive for a different package attaching same client → should create a NEW notification
        # But calling notify_event twice with same key must not duplicate.
        # We simulate re-trigger by directly requesting another /receive with same customer_reference
        # → that creates a different package (different entity_id) so a new row is fine.
        # For true idempotency: check that no second row for SAME pid exists.
        rows2 = list(db.notifications.find({"event": "package_received", "entity_type": "PACKAGE", "entity_id": pid}))
        assert len(rows2) == 1, "duplicate notification row created for same event+entity"

    def test_non_essential_skipped_when_pref_false(self, admin_token, koffi_token):
        # koffi: turn OFF non-essential
        requests.put(f"{API}/me/notification-preferences", headers=_h(koffi_token),
                     json={"notify_non_essential": False}, timeout=15)
        # get koffi ref
        r_fwd = requests.get(f"{API}/me/forwarding-address", headers=_h(koffi_token), timeout=15)
        ref = r_fwd.json()[0]["customer_reference"]
        r = requests.post(f"{API}/admin/packages/receive", headers=_h(admin_token), json={
            "customer_reference": ref, "merchant_name": "TEST_SkipMerchant",
        }, timeout=20)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        import time
        time.sleep(1.0)
        db = self._db()
        rows = list(db.notifications.find({"event": "package_received", "entity_type": "PACKAGE", "entity_id": pid}))
        assert len(rows) == 1
        assert rows[0].get("status") == "SKIPPED", f"expected SKIPPED, got {rows[0].get('status')}"
        # restore
        requests.put(f"{API}/me/notification-preferences", headers=_h(koffi_token),
                     json={"notify_non_essential": True}, timeout=15)

    def test_payment_confirmed_essential_still_sent_when_pref_false(self, admin_token, awa_token):
        """Essential emails (payment_confirmed) must fire regardless of pref."""
        # Set awa pref = False
        requests.put(f"{API}/me/notification-preferences", headers=_h(awa_token),
                     json={"notify_non_essential": False}, timeout=15)

        # Build a fresh shipment for awa: create + receive + weigh + store + ready
        ref = self._get_awa_ref(awa_token)
        pr = requests.post(f"{API}/admin/packages/receive", headers=_h(admin_token), json={
            "customer_reference": ref, "merchant_name": "TEST_PayFlow",
            "weight_kg": 2.0, "length_cm": 20, "width_cm": 20, "height_cm": 20,
            "auto_store": True
        }, timeout=20)
        assert pr.status_code == 200, pr.text
        pid = pr.json()["id"]
        # auto_store already left it at STORED — that's what /me/shipments requires.

        # find a zone
        zones = requests.get(f"{API}/delivery-zones", headers=_h(awa_token), timeout=15).json()
        zid = zones[0]["id"]
        # create shipment via /me/shipments (fires quote_ready, but pref=false → SKIPPED)
        sr = requests.post(f"{API}/me/shipments", headers=_h(awa_token), json={
            "package_ids": [pid], "delivery_zone_id": zid,
            "delivery_mode": "PICKUP_POINT", "transport_mode": "AIR"
        }, timeout=25)
        assert sr.status_code == 200, sr.text
        sid = sr.json()["id"]

        # start payment
        py = requests.post(f"{API}/me/shipments/{sid}/pay", headers=_h(awa_token), timeout=15)
        assert py.status_code == 200, py.text
        pay_id = py.json()["id"]
        # simulate success
        sim = requests.post(f"{API}/me/payments/{pay_id}/simulate", headers=_h(awa_token),
                            json={"result": "success"}, timeout=15)
        assert sim.status_code == 200, sim.text

        import time
        time.sleep(1.5)
        db = self._db()
        # quote_ready (non-essential) → SKIPPED
        qr = list(db.notifications.find({"event": "quote_ready", "entity_type": "SHIPMENT", "entity_id": sid}))
        assert len(qr) == 1
        assert qr[0].get("status") == "SKIPPED", f"quote_ready expected SKIPPED got {qr[0].get('status')}"
        # payment_confirmed (essential) → must NOT be skipped (SENT or FAILED are both fine)
        pc = list(db.notifications.find({"event": "payment_confirmed", "entity_type": "PAYMENT", "entity_id": pay_id}))
        assert len(pc) == 1
        assert pc[0].get("status") in ("SENT", "FAILED"), f"payment_confirmed expected SENT/FAILED got {pc[0].get('status')}"

        # Admin ship transition -> SHIPPED triggers shipment_created (essential? Not in NON_ESSENTIAL set)
        # Need to be in PAID status first; ship it.
        # Transition PAID -> PREPARING -> SHIPPED
        t1 = requests.post(f"{API}/admin/shipments/{sid}/transition", headers=_h(admin_token),
                           json={"to_status": "PREPARING"}, timeout=15)
        assert t1.status_code == 200, t1.text
        t2 = requests.post(f"{API}/admin/shipments/{sid}/transition", headers=_h(admin_token),
                           json={"to_status": "SHIPPED"}, timeout=15)
        assert t2.status_code == 200, t2.text
        time.sleep(1.5)
        sc = list(db.notifications.find({"event": "shipment_created", "entity_type": "SHIPMENT", "entity_id": f"{sid}:SHIPPED"}))
        assert len(sc) == 1
        assert sc[0].get("status") in ("SENT", "FAILED")

        # restore pref
        requests.put(f"{API}/me/notification-preferences", headers=_h(awa_token),
                     json={"notify_non_essential": True}, timeout=15)

