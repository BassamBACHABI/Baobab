import os
from decimal import Decimal

from core import now_utc, to_money, to_num
from db import db
from accounts import create_account, gen_customer_reference


async def create_indexes():
    await db.auth_users.create_index("email", unique=True)
    await db.user_roles.create_index([("user_id", 1), ("role", 1)], unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier", unique=True)
    await db.password_reset_tokens.create_index("token", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.apple_states.create_index("state", unique=True)
    await db.apple_states.create_index("expires_at", expireAfterSeconds=0)
    await db.auth_users.create_index([("provider", 1), ("provider_sub", 1)])
    await db.countries.create_index("code", unique=True)
    await db.forwarding_addresses.create_index("customer_reference", unique=True)
    await db.forwarding_addresses.create_index("user_id")
    await db.packages.create_index("reference", unique=True)
    await db.packages.create_index("user_id")
    await db.shipments.create_index("reference", unique=True)
    await db.shipments.create_index("user_id")
    await db.payments.create_index("user_id")
    await db.tracking_events.create_index("shipment_id")
    await db.status_history.create_index([("entity_type", 1), ("entity_id", 1)])
    await db.audit_log.create_index([("entity_type", 1), ("entity_id", 1)])
    await db.customer_addresses.create_index("user_id")
    await db.package_photos.create_index("package_id")
    await db.package_items.create_index("package_id")
    await db.notifications.create_index(
        [("event", 1), ("entity_type", 1), ("entity_id", 1)], unique=True
    )
    await db.push_subscriptions.create_index("endpoint", unique=True)
    await db.push_subscriptions.create_index("user_id")
    await db.proxy_orders.create_index("reference", unique=True)
    await db.proxy_orders.create_index("user_id")
    await db.cost_records.create_index("shipment_id")


DEFAULT_SETTINGS = {
    "eur_xof_rate": ("655.957", "num"),
    "volumetric_divisor": ("5000", "int"),
    "storage_free_days": ("14", "int"),
    "air_delivery_days_min": ("2", "int"),
    "air_delivery_days_max": ("3", "int"),
    "default_transport_mode": ("AIR", "str"),
    "proxy_commission_percent": ("10", "num"),
    "proxy_commission_min_eur": ("5", "num"),
}


async def seed_settings():
    for key, (value, kind) in DEFAULT_SETTINGS.items():
        if await db.app_settings.find_one({"key": key}):
            continue
        if kind == "num":
            stored = to_num(value)
        elif kind == "int":
            stored = int(value)
        else:
            stored = value
        await db.app_settings.insert_one(
            {"key": key, "value": stored, "kind": kind, "updated_at": now_utc()}
        )


async def seed_reference():
    # Pays
    if not await db.countries.find_one({"code": "FR"}):
        await db.countries.insert_one(
            {"code": "FR", "name": "France", "currency": "EUR", "active": True}
        )
    if not await db.countries.find_one({"code": "BJ"}):
        await db.countries.insert_one(
            {"code": "BJ", "name": "Bénin", "currency": "XOF", "active": True}
        )
    fr = await db.countries.find_one({"code": "FR"})

    # Hub Lille
    hub = await db.logistic_hubs.find_one({"name": "Hub Lille"})
    if not hub:
        res = await db.logistic_hubs.insert_one(
            {
                "country_id": str(fr["_id"]),
                "name": "Hub Lille",
                "address_line": "Zone logistique — adresse à confirmer",
                "city": "Lille",
                "postal_code": "59000",
                "active": True,
                "created_at": now_utc(),
            }
        )
        hub_id = str(res.inserted_id)
    else:
        hub_id = str(hub["_id"])

    # Transporteur
    if not await db.carriers.find_one({"name": "Baobab Line"}):
        await db.carriers.insert_one(
            {"name": "Baobab Line", "active": True, "created_at": now_utc()}
        )

    # Zones de livraison
    zones = [
        {"name": "Cotonou — Point relais", "city": "Cotonou", "delivery_mode": "PICKUP_POINT", "fee_xof": "1500.00"},
        {"name": "Cotonou — Domicile", "city": "Cotonou", "delivery_mode": "HOME", "fee_xof": "5000.00"},
    ]
    for z in zones:
        if not await db.delivery_zones.find_one({"name": z["name"]}):
            await db.delivery_zones.insert_one(
                {
                    "name": z["name"],
                    "city": z["city"],
                    "delivery_mode": z["delivery_mode"],
                    "fee_xof": to_money(z["fee_xof"]),
                    "active": True,
                    "created_at": now_utc(),
                }
            )

    # Tarifs (4 tranches, AIR, FR -> BJ, EUR)
    tranches = [
        ("0", "1", "12.00", "5.00"),
        ("1", "5", "9.50", "0.00"),
        ("5", "20", "7.00", "0.00"),
        ("20", "50", "5.50", "0.00"),
    ]
    if await db.tariffs.count_documents({"origin_country_id": str(fr["_id"])}) == 0:
        for mn, mx, ppk, fee in tranches:
            await db.tariffs.insert_one(
                {
                    "origin_country_id": str(fr["_id"]),
                    "destination_country_code": "BJ",
                    "service_type": "FREIGHT_FORWARDING",
                    "transport_mode": "AIR",
                    "min_weight_kg": to_money(mn),
                    "max_weight_kg": to_money(mx),
                    "price_per_kg": to_money(ppk),
                    "fixed_fee": to_money(fee),
                    "currency": "EUR",
                    "active": True,
                    "valid_from": now_utc(),
                }
            )
    return hub_id


async def seed_users():
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    if not await db.auth_users.find_one({"email": admin_email}):
        await create_account(
            email=admin_email, password=os.environ["ADMIN_PASSWORD"],
            first_name="Bassam", last_name="Bachabi", role="ADMIN",
            with_forwarding=False,
        )

    op_email = os.environ["OPERATOR_EMAIL"].lower()
    if not await db.auth_users.find_one({"email": op_email}):
        await create_account(
            email=op_email, password=os.environ["OPERATOR_PASSWORD"],
            first_name="Opérateur", last_name="Lille", role="OPERATOR",
            with_forwarding=False,
        )

    client_pwd = os.environ["SEED_CLIENT_PASSWORD"]
    clients = [
        ("awa@example.com", "Awa", "Sossou"),
        ("koffi@example.com", "Koffi", "Adjovi"),
    ]
    for email, first, last in clients:
        if not await db.auth_users.find_one({"email": email}):
            await create_account(
                email=email, password=client_pwd,
                first_name=first, last_name=last, phone="+22990000000",
                role="CLIENT", with_forwarding=True,
            )


async def seed_sample_package():
    """Un colis attendu pour le 1er client (démo d'isolation)."""
    c = await db.auth_users.find_one({"email": "awa@example.com"})
    if not c:
        return
    uid = str(c["_id"])
    if await db.packages.find_one({"user_id": uid}):
        return
    fwd = await db.forwarding_addresses.find_one({"user_id": uid})
    from accounts import gen_reference
    ref = await gen_reference("PKG", db.packages)
    await db.packages.insert_one(
        {
            "reference": ref,
            "user_id": uid,
            "forwarding_address_id": str(fwd["_id"]) if fwd else None,
            "hub_id": fwd["hub_id"] if fwd else None,
            "merchant_name": "Amazon FR",
            "tracking_in": "FR-TRACK-001",
            "weight_kg": None,
            "length_cm": None,
            "width_cm": None,
            "height_cm": None,
            "volumetric_weight_kg": None,
            "billable_weight_kg": None,
            "declared_value": to_money("49.90"),
            "content_category": "Électronique",
            "storage_location": None,
            "status": "EXPECTED",
            "received_at": None,
            "notes": None,
            "created_at": now_utc(),
        }
    )


async def run_seed():
    await create_indexes()
    await seed_settings()
    await seed_reference()
    await seed_users()
    await seed_sample_package()
