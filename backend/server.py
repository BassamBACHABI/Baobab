import os
import asyncio
import logging
from decimal import Decimal

import requests
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware

from db import db
from core import now_utc, serialize, to_money, to_decimal, oid
from models import (
    RegisterIn, LoginIn, GoogleSessionIn, ProfileUpdate, AddressIn,
    CountryIn, HubIn, CarrierIn, ZoneIn, TariffIn, SettingIn,
    PackageIn, WeighIn, PackageItemIn, TransitionIn, ShipmentIn, TrackingIn,
    PaymentIn, CostIn,
)
from security import (
    verify_password, create_access_token, get_current_user, require_roles,
    check_lockout, record_failure, clear_attempts, is_admin, is_staff,
)
from accounts import create_account, ensure_google_user, gen_reference
from statemachine import (
    transition_status, write_audit, STATUS_LABELS,
    PACKAGE_TRANSITIONS, SHIPMENT_TRANSITIONS, PAYMENT_TRANSITIONS,
)
from seed import run_seed

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("baobab")

app = FastAPI(title="Baobab Cargo API")
api = APIRouter(prefix="/api")

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


# ============ Helpers ============
async def get_setting(key, default=None):
    doc = await db.app_settings.find_one({"key": key})
    if not doc:
        return default
    return doc["value"]


def public_user(user):
    return {
        "id": user["id"], "email": user["email"], "name": user.get("name"),
        "picture": user.get("picture"), "provider": user.get("provider"),
        "roles": user["roles"], "profile_status": user.get("profile_status"),
    }


async def owns_or_staff(user, user_id_field_value):
    if is_staff(user):
        return True
    return user_id_field_value == user["id"]


# ============ AUTH ============
@api.get("/")
async def root():
    return {"service": "Baobab Cargo API", "status": "ok"}


@api.post("/auth/register")
async def register(body: RegisterIn):
    # Inscription publique => rôle CLIENT uniquement (jamais ADMIN)
    uid = await create_account(
        email=body.email, password=body.password,
        first_name=body.first_name, last_name=body.last_name, phone=body.phone,
        role="CLIENT", provider="password", with_forwarding=True,
    )
    token = create_access_token(uid)
    user = await _current(uid)
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


async def _current(uid):
    from security import _load_user
    return await _load_user(uid)


@api.post("/auth/login")
async def login(body: LoginIn, request: Request):
    email = body.email.strip().lower()
    ident = f"{request.client.host if request.client else 'x'}:{email}"
    await check_lockout(ident)
    auth = await db.auth_users.find_one({"email": email})
    if auth and not auth.get("password_hash"):
        raise HTTPException(
            status_code=401,
            detail="Ce compte utilise la connexion Google. Utilisez « Continuer avec Google ».",
        )
    if not auth or not verify_password(body.password, auth.get("password_hash") or ""):
        await record_failure(ident)
        raise HTTPException(status_code=401, detail="E-mail ou mot de passe incorrect.")
    await clear_attempts(ident)
    uid = str(auth["_id"])
    token = create_access_token(uid)
    user = await _current(uid)
    return {"access_token": token, "token_type": "bearer", "user": public_user(user)}


@api.post("/auth/google/session")
async def google_session(body: GoogleSessionIn, request: Request, response: Response):
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    session_id = body.session_id or request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id manquant")
    try:
        r = await asyncio.to_thread(
            lambda: requests.get(
                EMERGENT_SESSION_URL,
                headers={"X-Session-ID": session_id},
                timeout=15,
            )
        )
        r.raise_for_status()
        data = r.json()
    except Exception:
        raise HTTPException(status_code=401, detail="Session Google invalide ou expirée.")

    uid = await ensure_google_user(
        email=data["email"], name=data.get("name", ""), picture=data.get("picture")
    )
    session_token = data["session_token"]
    from datetime import timedelta
    await db.user_sessions.insert_one(
        {
            "user_id": uid,
            "session_token": session_token,
            "expires_at": now_utc() + timedelta(days=7),
            "created_at": now_utc(),
        }
    )
    response.set_cookie(
        key="session_token", value=session_token, httponly=True,
        secure=True, samesite="none", max_age=7 * 24 * 3600, path="/",
    )
    user = await _current(uid)
    return {"session_token": session_token, "user": public_user(user)}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return public_user(user)


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    # Best-effort : ne nécessite pas de jeton valide (un jeton expiré doit tout de même pouvoir se déconnecter).
    raw = request.cookies.get("session_token")
    if not raw:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            raw = auth_header[7:]
    if raw:
        await db.user_sessions.delete_one({"session_token": raw})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ============ REFERENCE (lecture: authentifié ; écriture: ADMIN) ============
@api.get("/reference/enums")
async def enums(user=Depends(get_current_user)):
    return {
        "labels": STATUS_LABELS,
        "transitions": {
            "PACKAGE": PACKAGE_TRANSITIONS,
            "SHIPMENT": SHIPMENT_TRANSITIONS,
            "PAYMENT": PAYMENT_TRANSITIONS,
        },
    }


@api.get("/countries")
async def list_countries(user=Depends(get_current_user)):
    return serialize(await db.countries.find().to_list(200))


@api.post("/countries")
async def create_country(body: CountryIn, user=Depends(require_roles("ADMIN"))):
    doc = body.model_dump()
    doc["created_at"] = now_utc()
    res = await db.countries.insert_one(doc)
    return serialize(await db.countries.find_one({"_id": res.inserted_id}))


@api.get("/hubs")
async def list_hubs(user=Depends(get_current_user)):
    return serialize(await db.logistic_hubs.find().to_list(200))


@api.post("/hubs")
async def create_hub(body: HubIn, user=Depends(require_roles("ADMIN"))):
    doc = body.model_dump()
    doc["created_at"] = now_utc()
    res = await db.logistic_hubs.insert_one(doc)
    return serialize(await db.logistic_hubs.find_one({"_id": res.inserted_id}))


@api.get("/carriers")
async def list_carriers(user=Depends(get_current_user)):
    return serialize(await db.carriers.find().to_list(200))


@api.post("/carriers")
async def create_carrier(body: CarrierIn, user=Depends(require_roles("ADMIN"))):
    doc = body.model_dump()
    doc["created_at"] = now_utc()
    res = await db.carriers.insert_one(doc)
    return serialize(await db.carriers.find_one({"_id": res.inserted_id}))


@api.get("/delivery-zones")
async def list_zones(user=Depends(get_current_user)):
    return serialize(await db.delivery_zones.find().to_list(200))


@api.post("/delivery-zones")
async def create_zone(body: ZoneIn, user=Depends(require_roles("ADMIN"))):
    doc = body.model_dump()
    doc["fee_xof"] = to_money(doc["fee_xof"])
    doc["created_at"] = now_utc()
    res = await db.delivery_zones.insert_one(doc)
    return serialize(await db.delivery_zones.find_one({"_id": res.inserted_id}))


@api.get("/tariffs")
async def list_tariffs(user=Depends(get_current_user)):
    return serialize(await db.tariffs.find().to_list(500))


@api.post("/tariffs")
async def create_tariff(body: TariffIn, user=Depends(require_roles("ADMIN"))):
    doc = body.model_dump()
    for f in ("min_weight_kg", "max_weight_kg", "price_per_kg", "fixed_fee"):
        doc[f] = to_money(doc[f])
    doc["valid_from"] = now_utc()
    before = None
    res = await db.tariffs.insert_one(doc)
    await write_audit(user["id"], "TARIFF_CREATE", "TARIFF", res.inserted_id, before, doc)
    return serialize(await db.tariffs.find_one({"_id": res.inserted_id}))


@api.get("/settings")
async def list_settings(user=Depends(get_current_user)):
    return serialize(await db.app_settings.find().to_list(100))


@api.put("/settings/{key}")
async def update_setting(key: str, body: SettingIn, user=Depends(require_roles("ADMIN"))):
    existing = await db.app_settings.find_one({"key": key})
    if not existing:
        raise HTTPException(status_code=404, detail="Paramètre introuvable")
    from core import to_num
    kind = existing.get("kind", "str")
    new_val = int(body.value) if kind == "int" else (to_num(body.value) if kind == "num" else body.value)
    await db.app_settings.update_one({"key": key}, {"$set": {"value": new_val, "updated_at": now_utc()}})
    await write_audit(user["id"], "SETTING_UPDATE", "SETTING", key,
                      {"value": existing.get("value")}, {"value": new_val})
    return serialize(await db.app_settings.find_one({"key": key}))


# ============ ESPACE CLIENT (isolation par user_id) ============
@api.get("/me/profile")
async def my_profile(user=Depends(get_current_user)):
    return serialize(await db.profiles.find_one({"_id": oid(user["id"])}))


@api.put("/me/profile")
async def update_my_profile(body: ProfileUpdate, user=Depends(get_current_user)):
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    if changes:
        await db.profiles.update_one({"_id": oid(user["id"])}, {"$set": changes})
    return serialize(await db.profiles.find_one({"_id": oid(user["id"])}))


@api.get("/me/forwarding-address")
async def my_forwarding(user=Depends(get_current_user)):
    docs = await db.forwarding_addresses.find({"user_id": user["id"]}).to_list(20)
    out = serialize(docs)
    for a in out:
        hub = await db.logistic_hubs.find_one({"_id": oid(a["hub_id"])}) if a.get("hub_id") else None
        a["hub"] = serialize(hub) if hub else None
    return out


@api.get("/me/addresses")
async def my_addresses(user=Depends(get_current_user)):
    return serialize(await db.customer_addresses.find({"user_id": user["id"]}).to_list(50))


@api.post("/me/addresses")
async def add_address(body: AddressIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc.update({"user_id": user["id"], "created_at": now_utc()})
    res = await db.customer_addresses.insert_one(doc)
    return serialize(await db.customer_addresses.find_one({"_id": res.inserted_id}))


@api.get("/me/packages")
async def my_packages(user=Depends(get_current_user)):
    return serialize(await db.packages.find({"user_id": user["id"]}).sort("created_at", -1).to_list(200))


@api.get("/me/packages/{pid}")
async def my_package(pid: str, user=Depends(get_current_user)):
    doc = await db.packages.find_one({"_id": oid(pid)})
    if not doc or not await owns_or_staff(user, doc.get("user_id")):
        raise HTTPException(status_code=404, detail="Colis introuvable")
    return serialize(doc)


@api.get("/me/packages/{pid}/photos")
async def my_package_photos(pid: str, user=Depends(get_current_user)):
    pkg = await db.packages.find_one({"_id": oid(pid)})
    if not pkg or not await owns_or_staff(user, pkg.get("user_id")):
        raise HTTPException(status_code=404, detail="Colis introuvable")
    return serialize(await db.package_photos.find({"package_id": pid}).to_list(100))


@api.get("/me/shipments")
async def my_shipments(user=Depends(get_current_user)):
    return serialize(await db.shipments.find({"user_id": user["id"]}).sort("created_at", -1).to_list(200))


@api.get("/me/shipments/{sid}")
async def my_shipment(sid: str, user=Depends(get_current_user)):
    doc = await db.shipments.find_one({"_id": oid(sid)})
    if not doc or not await owns_or_staff(user, doc.get("user_id")):
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    return serialize(doc)


@api.get("/me/shipments/{sid}/tracking")
async def my_tracking(sid: str, user=Depends(get_current_user)):
    doc = await db.shipments.find_one({"_id": oid(sid)})
    if not doc or not await owns_or_staff(user, doc.get("user_id")):
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    return serialize(await db.tracking_events.find({"shipment_id": sid}).sort("occurred_at", 1).to_list(200))


@api.get("/me/payments")
async def my_payments(user=Depends(get_current_user)):
    return serialize(await db.payments.find({"user_id": user["id"]}).sort("created_at", -1).to_list(200))


@api.post("/me/payments")
async def create_my_payment(body: PaymentIn, user=Depends(get_current_user)):
    # Un client ne peut PAS créer un paiement PAID — statut forcé à PENDING.
    if not body.shipment_id:
        raise HTTPException(status_code=400, detail="shipment_id requis")
    ship = await db.shipments.find_one({"_id": oid(body.shipment_id)})
    if not ship or ship.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    doc = {
        "user_id": user["id"],
        "shipment_id": body.shipment_id,
        "order_id": None,
        "provider": body.provider,
        "transaction_reference": body.transaction_reference,
        "amount": to_money(body.amount),
        "currency": body.currency,
        "status": "PENDING",
        "paid_at": None,
        "created_at": now_utc(),
    }
    res = await db.payments.insert_one(doc)
    return serialize(await db.payments.find_one({"_id": res.inserted_id}))


# ============ ADMIN : clients ============
@api.get("/admin/clients")
async def admin_clients(user=Depends(require_roles("ADMIN", "OPERATOR"))):
    profiles = await db.profiles.find().sort("created_at", -1).to_list(500)
    out = []
    for p in profiles:
        roles = [r["role"] async for r in db.user_roles.find({"user_id": str(p["_id"])})]
        if "CLIENT" not in roles:
            continue
        s = serialize(p)
        fwd = await db.forwarding_addresses.find_one({"user_id": str(p["_id"])})
        s["customer_reference"] = fwd["customer_reference"] if fwd else None
        out.append(s)
    return out


# ============ ADMIN/OPERATOR : colis + photos ============
@api.get("/admin/packages")
async def admin_list_packages(user=Depends(require_roles("ADMIN", "OPERATOR"))):
    return serialize(await db.packages.find().sort("created_at", -1).to_list(500))


@api.post("/admin/packages")
async def admin_create_package(body: PackageIn, user=Depends(require_roles("ADMIN", "OPERATOR"))):
    user_id = None
    fwd_id = None
    hub_id = body.hub_id
    status = "UNIDENTIFIED"
    if body.customer_reference:
        fwd = await db.forwarding_addresses.find_one({"customer_reference": body.customer_reference.strip().upper()})
        if not fwd:
            raise HTTPException(status_code=404, detail="Référence client introuvable")
        user_id = fwd["user_id"]
        fwd_id = str(fwd["_id"])
        hub_id = hub_id or fwd.get("hub_id")
        status = "RECEIVED"
    ref = await gen_reference("PKG", db.packages)
    doc = {
        "reference": ref, "user_id": user_id, "forwarding_address_id": fwd_id,
        "hub_id": hub_id, "merchant_name": body.merchant_name, "tracking_in": body.tracking_in,
        "weight_kg": None, "length_cm": None, "width_cm": None, "height_cm": None,
        "volumetric_weight_kg": None, "billable_weight_kg": None,
        "declared_value": to_money(body.declared_value) if body.declared_value is not None else None,
        "content_category": body.content_category, "storage_location": body.storage_location,
        "status": status, "received_at": now_utc() if status == "RECEIVED" else None,
        "notes": body.notes, "created_at": now_utc(),
    }
    res = await db.packages.insert_one(doc)
    await db.status_history.insert_one({
        "entity_type": "PACKAGE", "entity_id": str(res.inserted_id),
        "from_status": None, "to_status": status, "actor_id": user["id"],
        "reason": "Création", "created_at": now_utc(),
    })
    return serialize(await db.packages.find_one({"_id": res.inserted_id}))


@api.put("/admin/packages/{pid}/weigh")
async def admin_weigh(pid: str, body: WeighIn, user=Depends(require_roles("ADMIN", "OPERATOR"))):
    pkg = await db.packages.find_one({"_id": oid(pid)})
    if not pkg:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    divisor = int(await get_setting("volumetric_divisor", 5000))
    L, W, H = to_decimal(body.length_cm), to_decimal(body.width_cm), to_decimal(body.height_cm)
    weight = to_decimal(body.weight_kg)
    vol = (L * W * H) / Decimal(divisor)
    billable = max(weight, vol)
    before = {k: pkg.get(k) for k in ("weight_kg", "volumetric_weight_kg", "billable_weight_kg")}
    changes = {
        "weight_kg": to_money(weight), "length_cm": to_money(L), "width_cm": to_money(W),
        "height_cm": to_money(H), "volumetric_weight_kg": to_money(vol),
        "billable_weight_kg": to_money(billable), "updated_at": now_utc(),
    }
    await db.packages.update_one({"_id": oid(pid)}, {"$set": changes})
    await write_audit(user["id"], "PACKAGE_WEIGH", "PACKAGE", pid, before, changes)
    return serialize(await db.packages.find_one({"_id": oid(pid)}))


@api.post("/admin/packages/{pid}/items")
async def admin_add_item(pid: str, body: PackageItemIn, user=Depends(require_roles("ADMIN", "OPERATOR"))):
    if not await db.packages.find_one({"_id": oid(pid)}):
        raise HTTPException(status_code=404, detail="Colis introuvable")
    doc = body.model_dump()
    doc["declared_unit_value"] = to_money(doc["declared_unit_value"])
    doc.update({"package_id": pid, "created_at": now_utc()})
    res = await db.package_items.insert_one(doc)
    return serialize(await db.package_items.find_one({"_id": res.inserted_id}))


@api.post("/admin/packages/{pid}/transition")
async def admin_pkg_transition(pid: str, body: TransitionIn, user=Depends(require_roles("ADMIN", "OPERATOR"))):
    await transition_status("PACKAGE", pid, body.to_status, user["id"], body.reason)
    return serialize(await db.packages.find_one({"_id": oid(pid)}))


# ============ ADMIN : expéditions ============
@api.get("/admin/shipments")
async def admin_list_shipments(user=Depends(require_roles("ADMIN"))):
    return serialize(await db.shipments.find().sort("created_at", -1).to_list(500))


@api.post("/admin/shipments")
async def admin_create_shipment(body: ShipmentIn, user=Depends(require_roles("ADMIN"))):
    # Rattacher les colis + déterminer le client
    packages = []
    for p in body.package_ids:
        pkg = await db.packages.find_one({"_id": oid(p)})
        if not pkg:
            raise HTTPException(status_code=404, detail=f"Colis {p} introuvable")
        packages.append(pkg)
    user_id = packages[0]["user_id"] if packages else None
    total_billable = sum((to_decimal(p.get("billable_weight_kg")) or Decimal("0") for p in packages), Decimal("0"))
    hub_id = packages[0].get("hub_id") if packages else None
    ref = await gen_reference("SHP", db.shipments)
    doc = {
        "reference": ref, "user_id": user_id, "origin_hub_id": hub_id,
        "destination_country_code": body.destination_country_code,
        "destination_city": body.destination_city, "delivery_zone_id": body.delivery_zone_id,
        "delivery_mode": body.delivery_mode, "carrier_id": body.carrier_id,
        "transport_mode": body.transport_mode,
        "total_billable_weight_kg": to_money(total_billable),
        "cost_eur": None, "cost_xof": None, "tariff_snapshot": None,
        "tracking_number": None, "status": "DRAFT", "created_at": now_utc(),
    }
    res = await db.shipments.insert_one(doc)
    sid = str(res.inserted_id)
    for p in body.package_ids:
        await db.shipment_packages.insert_one({"shipment_id": sid, "package_id": p})
    await db.status_history.insert_one({
        "entity_type": "SHIPMENT", "entity_id": sid, "from_status": None,
        "to_status": "DRAFT", "actor_id": user["id"], "reason": "Création", "created_at": now_utc(),
    })
    await write_audit(user["id"], "SHIPMENT_CREATE", "SHIPMENT", sid, None, doc)
    return serialize(await db.shipments.find_one({"_id": res.inserted_id}))


@api.post("/admin/shipments/{sid}/transition")
async def admin_ship_transition(sid: str, body: TransitionIn, user=Depends(require_roles("ADMIN"))):
    await transition_status("SHIPMENT", sid, body.to_status, user["id"], body.reason)
    return serialize(await db.shipments.find_one({"_id": oid(sid)}))


@api.post("/admin/shipments/{sid}/tracking")
async def admin_add_tracking(sid: str, body: TrackingIn, user=Depends(require_roles("ADMIN"))):
    if not await db.shipments.find_one({"_id": oid(sid)}):
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    doc = {
        "shipment_id": sid, "status": body.status, "location": body.location,
        "message": body.message, "occurred_at": body.occurred_at or now_utc().isoformat(),
        "created_at": now_utc(),
    }
    res = await db.tracking_events.insert_one(doc)
    return serialize(await db.tracking_events.find_one({"_id": res.inserted_id}))


# ============ ADMIN uniquement : paiements & coûts (OPERATOR interdit) ============
@api.get("/admin/payments")
async def admin_payments(user=Depends(require_roles("ADMIN"))):
    return serialize(await db.payments.find().sort("created_at", -1).to_list(500))


@api.post("/admin/payments/{pid}/transition")
async def admin_payment_transition(pid: str, body: TransitionIn, user=Depends(require_roles("ADMIN"))):
    frm, to = await transition_status("PAYMENT", pid, body.to_status, user["id"], body.reason)
    if to == "PAID":
        await db.payments.update_one({"_id": oid(pid)}, {"$set": {"paid_at": now_utc()}})
    return serialize(await db.payments.find_one({"_id": oid(pid)}))


@api.get("/admin/cost-records")
async def admin_costs(user=Depends(require_roles("ADMIN"))):
    return serialize(await db.cost_records.find().sort("incurred_at", -1).to_list(500))


@api.post("/admin/cost-records")
async def admin_add_cost(body: CostIn, user=Depends(require_roles("ADMIN"))):
    doc = body.model_dump()
    doc["amount"] = to_money(doc["amount"])
    doc.update({"incurred_at": now_utc(), "created_at": now_utc()})
    res = await db.cost_records.insert_one(doc)
    await write_audit(user["id"], "COST_CREATE", "COST", res.inserted_id, None, doc)
    return serialize(await db.cost_records.find_one({"_id": res.inserted_id}))


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup():
    try:
        await run_seed()
        logger.info("Seed terminé.")
    except Exception as e:
        logger.exception("Seed échoué: %s", e)


@app.on_event("shutdown")
async def _shutdown():
    from db import client
    client.close()
