"""Batch tests: Rebrand, Proxy full flow, Support messaging, Tariffs edit/delete, Public tariffs."""
import os
import time
import pytest
import requests
from decimal import Decimal

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://europe-benin-log.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("bachabi.bassam@gmail.com", "Admin#Baobab2026")
OPERATOR = ("operator@baobabcargo.app", "Operator#2026")
AWA = ("awa@example.com", "Client#2026")
KOFFI = ("koffi@example.com", "Client#2026")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(*ADMIN)


@pytest.fixture(scope="module")
def operator_token():
    return _login(*OPERATOR)


@pytest.fixture(scope="module")
def awa_token():
    return _login(*AWA)


@pytest.fixture(scope="module")
def koffi_token():
    return _login(*KOFFI)


# ============ (1) Rebrand ============
class TestRebrand:
    def test_root_service_name(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert r.json()["service"] == "Baobab Transit API"


# ============ (5/6) Tariffs admin & public ============
class TestTariffs:
    def test_public_tariffs_no_auth(self):
        r = requests.get(f"{API}/public/tariffs", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Expected seeded AIR/BJ tariffs on landing"
        for t in data:
            assert "price_per_kg" in t and "fixed_fee" in t
            # Decimal128 serialised as strings
            assert isinstance(t["price_per_kg"], str)

    def _make_tariff_payload(self, admin_token):
        r = requests.get(f"{API}/countries", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        fr = next((c for c in r.json() if c.get("code") == "FR"), r.json()[0])
        return {
            "origin_country_id": fr["id"], "destination_country_code": "BJ",
            "transport_mode": "AIR", "min_weight_kg": "0", "max_weight_kg": "0.5",
            "price_per_kg": "9.99", "fixed_fee": "1.00", "active": True,
        }

    def test_admin_update_and_delete_tariff(self, admin_token):
        payload = self._make_tariff_payload(admin_token)
        r = requests.post(f"{API}/tariffs", json=payload, headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]

        # PUT update
        r = requests.put(f"{API}/tariffs/{tid}",
                         json={"price_per_kg": "12.50", "fixed_fee": "2.00"},
                         headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["price_per_kg"] == "12.50"
        assert d["fixed_fee"] == "2.00"

        # DELETE
        r = requests.delete(f"{API}/tariffs/{tid}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200

        # Verify gone
        r = requests.put(f"{API}/tariffs/{tid}", json={"price_per_kg": "1"},
                        headers=_h(admin_token), timeout=15)
        assert r.status_code == 404

    def test_operator_forbidden_on_tariff_writes(self, operator_token, admin_token):
        r = requests.post(f"{API}/tariffs", json=self._make_tariff_payload(admin_token),
                          headers=_h(admin_token), timeout=15)
        tid = r.json()["id"]
        try:
            r = requests.put(f"{API}/tariffs/{tid}", json={"price_per_kg": "10"},
                             headers=_h(operator_token), timeout=15)
            assert r.status_code == 403
            r = requests.delete(f"{API}/tariffs/{tid}", headers=_h(operator_token), timeout=15)
            assert r.status_code == 403
        finally:
            requests.delete(f"{API}/tariffs/{tid}", headers=_h(admin_token), timeout=15)


# ============ (4) Support messaging ============
class TestSupport:
    def test_client_cannot_access_admin_support(self, awa_token):
        r = requests.get(f"{API}/admin/support/threads", headers=_h(awa_token), timeout=15)
        assert r.status_code == 403

    def test_full_thread_flow(self, awa_token, admin_token, operator_token):
        # Client sends message
        msg = f"TEST_{int(time.time())} Bonjour, j'ai une question."
        r = requests.post(f"{API}/me/support/messages", json={"body": msg},
                          headers=_h(awa_token), timeout=15)
        assert r.status_code == 200, r.text
        assert any(m["body"] == msg for m in r.json())

        # Get awa user_id
        me = requests.get(f"{API}/auth/me", headers=_h(awa_token), timeout=15).json()
        awa_id = me["id"]

        # ADMIN sees threads list
        r = requests.get(f"{API}/admin/support/threads", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        threads = r.json()
        assert any(t.get("user_id") == awa_id for t in threads)

        # OPERATOR can list threads
        r = requests.get(f"{API}/admin/support/threads", headers=_h(operator_token), timeout=15)
        assert r.status_code == 200

        # ADMIN replies
        reply = f"TEST_REPLY_{int(time.time())} Bonjour, nous vous répondons."
        r = requests.post(f"{API}/admin/support/threads/{awa_id}",
                          json={"body": reply}, headers=_h(admin_token), timeout=15)
        assert r.status_code == 200

        # Client sees the reply
        r = requests.get(f"{API}/me/support/messages", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200
        bodies = [m["body"] for m in r.json()]
        assert reply in bodies


# ============ (2)(3) Proxy full flow ============
class TestProxyFullFlow:
    @pytest.fixture(scope="class")
    def zone_id(self, admin_token):
        r = requests.get(f"{API}/delivery-zones", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        zones = r.json()
        assert zones, "No delivery zones seeded"
        return zones[0]["id"]

    @pytest.fixture(scope="class")
    def order_id(self, awa_token):
        payload = {
            "items": [
                {"name": "TEST Sneakers", "quantity": 1, "unit_price_est": "80.00", "store": "Amazon"},
                {"name": "TEST Book", "quantity": 2, "unit_price_est": "15.00"},
            ],
            "notes": "TEST proxy order"
        }
        r = requests.post(f"{API}/me/proxy-orders", json=payload,
                          headers=_h(awa_token), timeout=15)
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_a_create_order(self, order_id, awa_token):
        r = requests.get(f"{API}/me/proxy-orders/{order_id}", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "REQUESTED"
        assert len(d["items"]) == 2

    def test_b_operator_forbidden_on_admin_proxy(self, operator_token, order_id):
        for path in [
            f"/admin/proxy-orders",
            f"/admin/proxy-orders/{order_id}",
        ]:
            r = requests.get(f"{API}{path}", headers=_h(operator_token), timeout=15)
            assert r.status_code == 403, f"{path} expected 403 got {r.status_code}"
        for path in [
            f"/admin/proxy-orders/{order_id}/quote",
            f"/admin/proxy-orders/{order_id}/receive",
        ]:
            r = requests.post(f"{API}{path}", json={}, headers=_h(operator_token), timeout=15)
            assert r.status_code == 403, f"{path} expected 403 got {r.status_code}"
        r = requests.post(f"{API}/admin/proxy-orders/{order_id}/hub-details",
                          json={"weight_kg": "1.5"}, headers=_h(operator_token), timeout=15)
        assert r.status_code == 403

    def test_c_cross_client_isolation(self, koffi_token, order_id):
        r = requests.get(f"{API}/me/proxy-orders/{order_id}", headers=_h(koffi_token), timeout=15)
        assert r.status_code == 404

    def test_d_admin_quote_commission(self, admin_token, order_id):
        r = requests.post(f"{API}/admin/proxy-orders/{order_id}/quote",
                          headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "QUOTED"
        # items_total = 80 + 15*2 = 110 ; total = items_total + commission
        assert d["items_total_eur"] == "110.00"
        commission = Decimal(d["commission_eur"])
        assert commission >= Decimal("5"), "min commission 5€"
        assert commission == Decimal("110.00") * Decimal(d["quote"]["commission_percent"]) / Decimal("100")
        assert Decimal(d["total_eur"]) == Decimal("110.00") + commission
        # No float artefacts
        assert isinstance(d["total_eur"], str)

    def test_e_hub_details_forbidden_before_paid(self, admin_token, order_id):
        r = requests.post(f"{API}/admin/proxy-orders/{order_id}/hub-details",
                          json={"weight_kg": "2.5"}, headers=_h(admin_token), timeout=15)
        assert r.status_code == 409

    def test_f_client_pays_and_simulates(self, awa_token, order_id):
        r = requests.post(f"{API}/me/proxy-orders/{order_id}/pay",
                          headers=_h(awa_token), timeout=15)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        r = requests.post(f"{API}/me/payments/{pid}/simulate",
                          json={"result": "success"}, headers=_h(awa_token), timeout=15)
        assert r.status_code == 200, r.text
        # verify order paid
        r = requests.get(f"{API}/me/proxy-orders/{order_id}", headers=_h(awa_token), timeout=15)
        assert r.json()["status"] == "PAID"

    def test_g_receive_rejected_without_weight(self, admin_token, order_id):
        r = requests.post(f"{API}/admin/proxy-orders/{order_id}/receive",
                          json={}, headers=_h(admin_token), timeout=15)
        assert r.status_code == 409

    def test_h_hub_details_with_weight_and_photo(self, admin_token, order_id):
        photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        r = requests.post(f"{API}/admin/proxy-orders/{order_id}/hub-details",
                          json={"weight_kg": "3.25", "photo": photo},
                          headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["received_weight_kg"] == "3.25"
        assert d["received_photo"] == photo

    def test_i_receive_succeeds(self, admin_token, order_id):
        r = requests.post(f"{API}/admin/proxy-orders/{order_id}/receive",
                          json={}, headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "RECEIVED"

    def test_j_client_ship_quote(self, awa_token, order_id, zone_id):
        r = requests.post(f"{API}/me/proxy-orders/{order_id}/ship-quote",
                          json={"delivery_zone_id": zone_id, "delivery_mode": "PICKUP_POINT",
                                "transport_mode": "AIR"},
                          headers=_h(awa_token), timeout=15)
        assert r.status_code == 200, r.text
        snap = r.json()
        assert "total_eur" in snap and isinstance(snap["total_eur"], str)

    def test_k_client_ship_creates_shipment(self, awa_token, order_id, zone_id):
        r = requests.post(f"{API}/me/proxy-orders/{order_id}/ship",
                          json={"delivery_zone_id": zone_id, "delivery_mode": "PICKUP_POINT",
                                "transport_mode": "AIR"},
                          headers=_h(awa_token), timeout=15)
        assert r.status_code == 200, r.text
        ship = r.json()
        assert ship["proxy_order_id"] == order_id
        assert ship["status"] == "AWAITING_PAYMENT"
        sid = ship["id"]

        # Second ship should be rejected
        r = requests.post(f"{API}/me/proxy-orders/{order_id}/ship",
                          json={"delivery_zone_id": zone_id, "delivery_mode": "PICKUP_POINT",
                                "transport_mode": "AIR"},
                          headers=_h(awa_token), timeout=15)
        assert r.status_code == 409

        # Appears in my shipments
        r = requests.get(f"{API}/me/shipments", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200
        assert any(s["id"] == sid for s in r.json())

        # Client pays & simulates
        r = requests.post(f"{API}/me/shipments/{sid}/pay", headers=_h(awa_token), timeout=15)
        assert r.status_code == 200, r.text
        pay_id = r.json()["id"]
        r = requests.post(f"{API}/me/payments/{pay_id}/simulate",
                          json={"result": "success"}, headers=_h(awa_token), timeout=15)
        assert r.status_code == 200, r.text
