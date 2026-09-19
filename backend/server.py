import os
import asyncio
import logging
import secrets
import base64
from decimal import Decimal
from datetime import timezone, timedelta
from urllib.parse import urlencode

import requests
import jwt
from jwt import PyJWKClient
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Form, Query
from fastapi.responses import RedirectResponse
from starlette.middleware.cors import CORSMiddleware

from db import db
from core import now_utc, serialize, to_money, to_decimal, oid
from models import (
    RegisterIn, LoginIn, GoogleSessionIn, ProfileUpdate, AddressIn,
    CountryIn, HubIn, CarrierIn, ZoneIn, TariffIn, SettingIn,
    PackageIn, WeighIn, PackageItemIn, TransitionIn, ShipmentIn, TrackingIn,
    PaymentIn, CostIn, ForgotIn, ResetIn, DeclareIn, ReceiveIn, AttachIn,
    QuoteIn, ShipmentUpdateIn, WebhookIn, SimulateIn, PrefIn,
    PushSubscribeIn, PushUnsubscribeIn,
)
from security import (
    verify_password, hash_password, create_access_token, get_current_user, require_roles,
    check_lockout, record_failure, clear_attempts, is_admin, is_staff,
)
from accounts import create_account, ensure_google_user, ensure_social_user, gen_reference
from statemachine import (
    transition_status, write_audit, STATUS_LABELS,
    PACKAGE_TRANSITIONS, SHIPMENT_TRANSITIONS, PAYMENT_TRANSITIONS,
)
from payments_provider import provider as pay_provider
from emailer import notify_event
from push import push_to_user
from seed import run_seed


def _q2(x):
    return str(Decimal(str(x)).quantize(Decimal("0.01")))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("baobab")

app = FastAPI(title="Baobab Cargo API")
api = APIRouter(prefix="/api")

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

APPLE_CLIENT_ID = os.environ.get("APPLE_CLIENT_ID", "")
APPLE_REDIRECT_URI = os.environ.get("APPLE_REDIRECT_URI", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "")
APPLE_ISSUER = "https://appleid.apple.com"

_jwks_client = None


def _apple_jwks():
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient("https://appleid.apple.com/auth/keys")
    return _jwks_client


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


async def _client_contact(user_id):
    if not user_id:
        return None
    prof = await db.profiles.find_one({"_id": oid(user_id)})
    if not prof or not prof.get("email"):
        return None
    name = f"{prof.get('first_name', '')} {prof.get('last_name', '')}".strip() or "client"
    return {"email": prof["email"], "name": name}


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

    uid = await ensure_social_user(
        provider="google", sub=str(data.get("id") or data["email"]),
        email=data["email"], name=data.get("name", ""), picture=data.get("picture"),
    )
    session_token = data["session_token"]
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


# ============ MOT DE PASSE OUBLIÉ ============
@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn):
    email = body.email.strip().lower()
    auth = await db.auth_users.find_one({"email": email})
    if auth and auth.get("password_hash"):
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": str(auth["_id"]),
            "expires_at": now_utc() + timedelta(hours=1), "used": False, "created_at": now_utc(),
        })
        logger.info("LIEN DE RÉINITIALISATION pour %s : %s/reset-password?token=%s", email, FRONTEND_URL, token)
    # Réponse générique (ne révèle pas l'existence du compte)
    return {"ok": True, "message": "Si un compte existe, un lien de réinitialisation a été envoyé."}


@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": body.token})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Lien invalide ou déjà utilisé.")
    exp = rec["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(status_code=400, detail="Lien expiré. Veuillez en demander un nouveau.")
    await db.auth_users.update_one({"_id": oid(rec["user_id"])}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await db.password_reset_tokens.update_one({"_id": rec["_id"]}, {"$set": {"used": True}})
    return {"ok": True}


# ============ SIGN IN WITH APPLE (web, vérification serveur du jeton) ============
@api.get("/auth/apple/start")
async def apple_start():
    if not APPLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="La connexion Apple n'est pas encore configurée.")
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    await db.apple_states.insert_one({
        "state": state, "nonce": nonce, "expires_at": now_utc() + timedelta(minutes=10),
    })
    params = {
        "client_id": APPLE_CLIENT_ID, "redirect_uri": APPLE_REDIRECT_URI,
        "response_type": "code id_token", "response_mode": "form_post",
        "scope": "name email", "state": state, "nonce": nonce,
    }
    return {"authorization_url": "https://appleid.apple.com/auth/authorize?" + urlencode(params)}


@api.post("/auth/apple/callback")
async def apple_callback(request: Request):
    form = await request.form()
    id_token = form.get("id_token")
    state = form.get("state")
    if not id_token or not state:
        raise HTTPException(status_code=400, detail="Réponse Apple incomplète")

    tx = await db.apple_states.find_one_and_delete({"state": state})
    if not tx:
        raise HTTPException(status_code=400, detail="Paramètre state invalide ou déjà utilisé")
    exp = tx["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(status_code=400, detail="Session Apple expirée")

    try:
        signing_key = _apple_jwks().get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token, signing_key.key, algorithms=["RS256"],
            audience=APPLE_CLIENT_ID, issuer=APPLE_ISSUER,
            options={"require": ["exp", "iat", "iss", "aud", "sub", "nonce"]},
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Jeton d'identité Apple invalide")

    if claims.get("nonce") != tx["nonce"]:
        raise HTTPException(status_code=401, detail="nonce invalide")

    name = ""
    raw_user = form.get("user")
    if raw_user:
        try:
            import json
            nm = json.loads(raw_user).get("name", {})
            name = f"{nm.get('firstName', '')} {nm.get('lastName', '')}".strip()
        except Exception:
            pass

    uid = await ensure_social_user(
        provider="apple", sub=claims["sub"], email=claims.get("email"),
        name=name or None, picture=None,
    )
    token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({
        "user_id": uid, "session_token": token,
        "expires_at": now_utc() + timedelta(days=7), "created_at": now_utc(),
    })
    roles = [r["role"] async for r in db.user_roles.find({"user_id": uid})]
    dest = "/admin" if ("ADMIN" in roles or "OPERATOR" in roles) else "/client"
    return RedirectResponse(
        url=f"{FRONTEND_URL}/auth/apple-return?token={token}&dest={dest}", status_code=303
    )


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
    await write_audit(user["id"], "HUB_CREATE", "HUB", res.inserted_id, None, doc)
    return serialize(await db.logistic_hubs.find_one({"_id": res.inserted_id}))


@api.get("/carriers")
async def list_carriers(user=Depends(get_current_user)):
    return serialize(await db.carriers.find().to_list(200))


@api.post("/carriers")
async def create_carrier(body: CarrierIn, user=Depends(require_roles("ADMIN"))):
    doc = body.model_dump()
    doc["created_at"] = now_utc()
    res = await db.carriers.insert_one(doc)
    await write_audit(user["id"], "CARRIER_CREATE", "CARRIER", res.inserted_id, None, doc)
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
    await write_audit(user["id"], "ZONE_CREATE", "ZONE", res.inserted_id, None, doc)
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


@api.get("/me/notification-preferences")
async def get_notification_prefs(user=Depends(get_current_user)):
    prof = await db.profiles.find_one({"_id": oid(user["id"])})
    return {"notify_non_essential": (prof or {}).get("notify_non_essential", True)}


@api.put("/me/notification-preferences")
async def set_notification_prefs(body: PrefIn, user=Depends(get_current_user)):
    await db.profiles.update_one(
        {"_id": oid(user["id"])},
        {"$set": {"notify_non_essential": body.notify_non_essential, "updated_at": now_utc()}},
    )
    return {"notify_non_essential": body.notify_non_essential}


@api.get("/push/vapid-public-key")
async def push_vapid_key():
    return {"public_key": os.environ.get("VAPID_PUBLIC_KEY", "")}


@api.post("/me/push/subscribe")
async def push_subscribe(body: PushSubscribeIn, user=Depends(get_current_user)):
    endpoint = body.subscription.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Abonnement push invalide")
    await db.push_subscriptions.update_one(
        {"endpoint": endpoint},
        {
            "$set": {
                "user_id": user["id"], "endpoint": endpoint,
                "subscription": body.subscription, "updated_at": now_utc(),
            },
            "$setOnInsert": {"created_at": now_utc()},
        },
        upsert=True,
    )
    return {"ok": True}


@api.post("/me/push/unsubscribe")
async def push_unsubscribe(body: PushUnsubscribeIn, user=Depends(get_current_user)):
    await db.push_subscriptions.delete_one({"endpoint": body.endpoint, "user_id": user["id"]})
    return {"ok": True}


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
    docs = await db.package_photos.find({"package_id": pid}).to_list(100)
    return [{"id": str(d["_id"]), "url": f"data:{d.get('content_type', 'image/jpeg')};base64,{d['data']}"} for d in docs]


@api.get("/me/packages/{pid}/history")
async def my_package_history(pid: str, user=Depends(get_current_user)):
    pkg = await db.packages.find_one({"_id": oid(pid)})
    if not pkg or not await owns_or_staff(user, pkg.get("user_id")):
        raise HTTPException(status_code=404, detail="Colis introuvable")
    return serialize(await db.status_history.find({"entity_type": "PACKAGE", "entity_id": pid}).sort("created_at", 1).to_list(200))


@api.get("/me/packages/{pid}/items")
async def my_package_items(pid: str, user=Depends(get_current_user)):
    pkg = await db.packages.find_one({"_id": oid(pid)})
    if not pkg or not await owns_or_staff(user, pkg.get("user_id")):
        raise HTTPException(status_code=404, detail="Colis introuvable")
    return serialize(await db.package_items.find({"package_id": pid}).to_list(200))


@api.post("/me/packages/declare")
async def declare_package(body: DeclareIn, user=Depends(get_current_user)):
    fwd = await db.forwarding_addresses.find_one({"user_id": user["id"]})
    ref = await gen_reference("PKG", db.packages)
    doc = {
        "reference": ref, "user_id": user["id"],
        "forwarding_address_id": str(fwd["_id"]) if fwd else None,
        "hub_id": fwd["hub_id"] if fwd else None,
        "merchant_name": body.merchant_name, "tracking_in": body.tracking_in,
        "weight_kg": None, "length_cm": None, "width_cm": None, "height_cm": None,
        "volumetric_weight_kg": None, "billable_weight_kg": None,
        "declared_value": to_money(body.declared_value) if body.declared_value is not None else None,
        "content_category": body.content_category, "storage_location": None,
        "status": "EXPECTED", "received_at": None, "notes": None, "created_at": now_utc(),
    }
    res = await db.packages.insert_one(doc)
    pid = str(res.inserted_id)
    await db.status_history.insert_one({"entity_type": "PACKAGE", "entity_id": pid, "from_status": None, "to_status": "EXPECTED", "actor_id": user["id"], "reason": "Déclaration client", "created_at": now_utc()})
    for it in body.items:
        d = it.model_dump()
        d["declared_unit_value"] = to_money(d["declared_unit_value"])
        d.update({"package_id": pid, "created_at": now_utc()})
        await db.package_items.insert_one(d)
    return serialize(await db.packages.find_one({"_id": res.inserted_id}))


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


async def compute_quote(package_ids, delivery_zone_id, transport_mode, user):
    if not package_ids:
        raise HTTPException(status_code=400, detail="Sélectionnez au moins un colis")
    pkgs = []
    for pid in package_ids:
        p = await db.packages.find_one({"_id": oid(pid)})
        if not p or p.get("user_id") != user["id"]:
            raise HTTPException(status_code=404, detail="Colis introuvable")
        if p.get("status") != "STORED":
            raise HTTPException(status_code=409, detail=f"Le colis {p['reference']} n'est pas au statut STOCKÉ")
        async for l in db.shipment_packages.find({"package_id": pid}):
            s = await db.shipments.find_one({"_id": oid(l["shipment_id"])})
            if s and s.get("status") != "DELIVERED":
                raise HTTPException(status_code=409, detail=f"Le colis {p['reference']} est déjà dans une expédition")
        pkgs.append(p)
    users = {p.get("user_id") for p in pkgs}
    if len(users) > 1:
        raise HTTPException(status_code=409, detail="Une expédition ne regroupe que des colis d'un même client")
    total_bill = sum((to_decimal(p.get("billable_weight_kg")) or Decimal("0") for p in pkgs), Decimal("0"))
    zone = await db.delivery_zones.find_one({"_id": oid(delivery_zone_id)})
    if not zone:
        raise HTTPException(status_code=404, detail="Zone de livraison introuvable")
    hub_id = pkgs[0].get("hub_id")
    hub = await db.logistic_hubs.find_one({"_id": oid(hub_id)}) if hub_id else None
    q = {"destination_country_code": "BJ", "service_type": "FREIGHT_FORWARDING", "transport_mode": transport_mode, "active": True}
    if hub and hub.get("country_id"):
        q["origin_country_id"] = hub["country_id"]
    tariff = None
    for t in await db.tariffs.find(q).to_list(100):
        if to_decimal(t["min_weight_kg"]) <= total_bill <= to_decimal(t["max_weight_kg"]):
            tariff = t
            break
    if not tariff:
        raise HTTPException(status_code=409, detail="Aucun tarif ne correspond au poids facturable")
    rate = to_decimal(await get_setting("eur_xof_rate", 655.957))
    divisor = int(await get_setting("volumetric_divisor", 5000))
    transport_eur = to_decimal(tariff["fixed_fee"]) + to_decimal(tariff["price_per_kg"]) * total_bill
    delivery_xof = to_decimal(zone["fee_xof"])
    delivery_eur = delivery_xof / rate
    total_eur = transport_eur + delivery_eur
    total_xof = total_eur * rate
    snap = {
        "tariff_id": str(tariff["_id"]), "price_per_kg": str(tariff["price_per_kg"]),
        "fixed_fee": str(tariff["fixed_fee"]), "eur_xof_rate": str(rate), "volumetric_divisor": divisor,
        "transport_mode": transport_mode, "total_billable_weight_kg": _q2(total_bill),
        "transport_eur": _q2(transport_eur), "delivery_fee_xof": _q2(delivery_xof),
        "delivery_fee_eur": _q2(delivery_eur), "total_eur": _q2(total_eur), "total_xof": _q2(total_xof),
        "zone_id": str(zone["_id"]), "zone_name": zone["name"], "zone_city": zone["city"],
    }
    return pkgs, zone, snap, total_bill, total_eur, total_xof


@api.post("/me/shipments/quote")
async def shipment_quote(body: QuoteIn, user=Depends(get_current_user)):
    _, _, snap, _, _, _ = await compute_quote(body.package_ids, body.delivery_zone_id, body.transport_mode, user)
    return snap


@api.post("/me/shipments")
async def create_shipment(body: QuoteIn, user=Depends(get_current_user)):
    pkgs, zone, snap, total_bill, total_eur, total_xof = await compute_quote(body.package_ids, body.delivery_zone_id, body.transport_mode, user)
    ref = await gen_reference("SHP", db.shipments)
    doc = {
        "reference": ref, "user_id": user["id"], "origin_hub_id": pkgs[0].get("hub_id"),
        "destination_country_code": "BJ", "destination_city": zone["city"],
        "delivery_zone_id": body.delivery_zone_id, "delivery_mode": body.delivery_mode,
        "carrier_id": None, "transport_mode": body.transport_mode,
        "total_billable_weight_kg": to_money(total_bill), "cost_eur": to_money(total_eur),
        "cost_xof": to_money(total_xof), "tariff_snapshot": snap, "tracking_number": None,
        "status": "DRAFT", "created_at": now_utc(),
    }
    res = await db.shipments.insert_one(doc)
    sid = str(res.inserted_id)
    for pid in body.package_ids:
        await db.shipment_packages.insert_one({"shipment_id": sid, "package_id": pid})
    await db.status_history.insert_one({"entity_type": "SHIPMENT", "entity_id": sid, "from_status": None, "to_status": "DRAFT", "actor_id": user["id"], "reason": "Création", "created_at": now_utc()})
    await write_audit(user["id"], "SHIPMENT_CREATE", "SHIPMENT", sid, None, snap)
    await transition_status("SHIPMENT", sid, "AWAITING_PAYMENT", user["id"], "Devis validé")
    contact = await _client_contact(user["id"])
    if contact:
        await notify_event(
            "quote_ready", "SHIPMENT", sid, to_email=contact["email"], user_id=user["id"],
            ctx={"name": contact["name"], "reference": ref, "sid": sid,
                 "total_eur": snap.get("total_eur"), "total_xof": snap.get("total_xof")},
        )
    await push_to_user(user["id"], "Devis prêt",
                       f"Votre devis {ref} est disponible : {snap.get('total_eur')} €.",
                       f"/client/shipments/{sid}")
    return serialize(await db.shipments.find_one({"_id": res.inserted_id}))


@api.post("/me/shipments/{sid}/pay")
async def start_payment(sid: str, user=Depends(get_current_user)):
    ship = await db.shipments.find_one({"_id": oid(sid)})
    if not ship or ship.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    existing = await db.payments.find_one({"shipment_id": sid, "status": {"$in": ["PENDING", "AUTHORIZED", "PAID"]}})
    if existing:
        return serialize(existing)
    doc = {
        "user_id": user["id"], "shipment_id": sid, "order_id": None, "provider": pay_provider.name,
        "transaction_reference": None, "amount": ship.get("cost_xof"), "currency": "XOF",
        "status": "PENDING", "paid_at": None, "created_at": now_utc(),
    }
    res = await db.payments.insert_one(doc)
    checkout = pay_provider.initiate(str(res.inserted_id), _q2(to_decimal(ship.get("cost_xof")) or 0), "XOF")
    await db.payments.update_one({"_id": res.inserted_id}, {"$set": {"transaction_reference": checkout["checkout_ref"]}})
    return serialize(await db.payments.find_one({"_id": res.inserted_id}))


async def _process_payment(payment_id, result, actor):
    p = await db.payments.find_one({"_id": oid(payment_id)})
    if not p:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    if p["status"] in ("PAID", "FAILED", "REFUNDED", "CANCELLED"):
        return {"status": p["status"], "idempotent": True}
    if result == "success":
        await transition_status("PAYMENT", payment_id, "PAID", actor, "Confirmation prestataire")
        await db.payments.update_one({"_id": oid(payment_id)}, {"$set": {"paid_at": now_utc()}})
        sid = p.get("shipment_id")
        if sid:
            s = await db.shipments.find_one({"_id": oid(sid)})
            if s and s.get("status") == "AWAITING_PAYMENT":
                await transition_status("SHIPMENT", sid, "PAID", actor, "Paiement confirmé")
            if s:
                contact = await _client_contact(s.get("user_id"))
                if contact:
                    await notify_event(
                        "payment_confirmed", "PAYMENT", payment_id, to_email=contact["email"],
                        user_id=s.get("user_id"),
                        ctx={"name": contact["name"], "reference": s.get("reference"), "sid": sid,
                             "amount": str(to_decimal(p.get("amount")) or ""), "currency": p.get("currency", "XOF")},
                    )
                await push_to_user(s.get("user_id"), "Paiement confirmé",
                                   f"Paiement reçu pour l'expédition {s.get('reference')}.",
                                   f"/client/shipments/{sid}")
        return {"status": "PAID"}
    await transition_status("PAYMENT", payment_id, "FAILED", actor, "Échec du paiement")
    return {"status": "FAILED"}


@api.post("/payments/webhook")
async def payment_webhook(body: WebhookIn, request: Request):
    if not pay_provider.verify_webhook(request.headers.get("X-Webhook-Secret", "")):
        raise HTTPException(status_code=401, detail="Signature de webhook invalide")
    return await _process_payment(body.payment_id, body.result, "system")


@api.post("/me/payments/{pid}/simulate")
async def simulate_payment(pid: str, body: SimulateIn, user=Depends(get_current_user)):
    p = await db.payments.find_one({"_id": oid(pid)})
    if not p or p.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Paiement introuvable")
    # Le navigateur déclenche la simulation ; la confirmation est traitée côté serveur (jamais PAID par le client).
    return await _process_payment(pid, body.result, "system")


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
async def admin_list_packages(status: str = None, customer_reference: str = None, hub_id: str = None, unidentified: bool = False, user=Depends(require_roles("ADMIN", "OPERATOR"))):
    q = {}
    if unidentified:
        q["status"] = "UNIDENTIFIED"
    elif status:
        q["status"] = status
    if hub_id:
        q["hub_id"] = hub_id
    if customer_reference:
        fwd = await db.forwarding_addresses.find_one({"customer_reference": customer_reference.strip().upper()})
        q["user_id"] = fwd["user_id"] if fwd else "__none__"
    return serialize(await db.packages.find(q).sort("created_at", -1).to_list(500))


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


@api.get("/admin/packages/{pid}")
async def admin_package_detail(pid: str, user=Depends(require_roles("ADMIN", "OPERATOR"))):
    doc = await db.packages.find_one({"_id": oid(pid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    out = serialize(doc)
    if doc.get("user_id"):
        prof = await db.profiles.find_one({"_id": oid(doc["user_id"])})
        out["client"] = serialize(prof) if prof else None
        fwd = await db.forwarding_addresses.find_one({"user_id": doc["user_id"]})
        out["customer_reference"] = fwd["customer_reference"] if fwd else None
    out["items"] = serialize(await db.package_items.find({"package_id": pid}).to_list(200))
    out["history"] = serialize(await db.status_history.find({"entity_type": "PACKAGE", "entity_id": pid}).sort("created_at", 1).to_list(200))
    photos = await db.package_photos.find({"package_id": pid}).to_list(100)
    out["photos"] = [{"id": str(p["_id"]), "url": f"data:{p.get('content_type', 'image/jpeg')};base64,{p['data']}"} for p in photos]
    return out


@api.get("/admin/expected")
async def admin_expected_for_ref(customer_reference: str, user=Depends(require_roles("ADMIN", "OPERATOR"))):
    fwd = await db.forwarding_addresses.find_one({"customer_reference": customer_reference.strip().upper()})
    if not fwd:
        return []
    return serialize(await db.packages.find({"user_id": fwd["user_id"], "status": "EXPECTED"}).to_list(50))


def _weigh(divisor, weight, L, W, H):
    vol = (L * W * H) / Decimal(divisor)
    return vol, max(weight, vol)


@api.post("/admin/packages/receive")
async def admin_receive(body: ReceiveIn, user=Depends(require_roles("ADMIN", "OPERATOR"))):
    user_id = None
    fwd_id = None
    hub_id = body.hub_id
    if body.customer_reference:
        fwd = await db.forwarding_addresses.find_one({"customer_reference": body.customer_reference.strip().upper()})
        if not fwd:
            raise HTTPException(status_code=404, detail="Référence client introuvable")
        user_id = fwd["user_id"]
        fwd_id = str(fwd["_id"])
        hub_id = hub_id or fwd.get("hub_id")

    weigh_set = None not in (body.weight_kg, body.length_cm, body.width_cm, body.height_cm)
    vol = billable = None
    if weigh_set:
        divisor = int(await get_setting("volumetric_divisor", 5000))
        vol, billable = _weigh(divisor, to_decimal(body.weight_kg), to_decimal(body.length_cm), to_decimal(body.width_cm), to_decimal(body.height_cm))
    wf = {
        "weight_kg": to_money(body.weight_kg) if body.weight_kg is not None else None,
        "length_cm": to_money(body.length_cm) if body.length_cm is not None else None,
        "width_cm": to_money(body.width_cm) if body.width_cm is not None else None,
        "height_cm": to_money(body.height_cm) if body.height_cm is not None else None,
        "volumetric_weight_kg": to_money(vol) if vol is not None else None,
        "billable_weight_kg": to_money(billable) if billable is not None else None,
    }

    if body.expected_package_id:
        pkg = await db.packages.find_one({"_id": oid(body.expected_package_id)})
        if not pkg or pkg.get("status") != "EXPECTED":
            raise HTTPException(status_code=400, detail="Colis attendu invalide")
        pid = body.expected_package_id
        upd = {**wf, "received_at": now_utc(), "storage_location": body.storage_location, "updated_at": now_utc()}
        if body.merchant_name:
            upd["merchant_name"] = body.merchant_name
        if body.tracking_in:
            upd["tracking_in"] = body.tracking_in
        if body.declared_value is not None:
            upd["declared_value"] = to_money(body.declared_value)
        if body.content_category:
            upd["content_category"] = body.content_category
        if user_id:
            upd.update({"user_id": user_id, "forwarding_address_id": fwd_id, "hub_id": hub_id})
        await db.packages.update_one({"_id": oid(pid)}, {"$set": upd})
        await write_audit(user["id"], "PACKAGE_RECEIVE", "PACKAGE", pid, {"status": "EXPECTED"}, wf)
        await transition_status("PACKAGE", pid, "RECEIVED", user["id"], "Réception")
    else:
        status = "RECEIVED" if user_id else "UNIDENTIFIED"
        ref = await gen_reference("PKG", db.packages)
        doc = {
            "reference": ref, "user_id": user_id, "forwarding_address_id": fwd_id, "hub_id": hub_id,
            "merchant_name": body.merchant_name, "tracking_in": body.tracking_in, **wf,
            "declared_value": to_money(body.declared_value) if body.declared_value is not None else None,
            "content_category": body.content_category, "storage_location": body.storage_location,
            "status": status, "received_at": now_utc(), "notes": body.notes, "created_at": now_utc(),
        }
        res = await db.packages.insert_one(doc)
        pid = str(res.inserted_id)
        await db.status_history.insert_one({"entity_type": "PACKAGE", "entity_id": pid, "from_status": None, "to_status": status, "actor_id": user["id"], "reason": "Réception", "created_at": now_utc()})

    pkg = await db.packages.find_one({"_id": oid(pid)})
    if pkg.get("user_id") and body.auto_store and pkg.get("status") == "RECEIVED":
        await transition_status("PACKAGE", pid, "INSPECTED", user["id"], "Inspection")
        await transition_status("PACKAGE", pid, "STORED", user["id"], "Mise en stock")
    pkg = await db.packages.find_one({"_id": oid(pid)})
    if pkg.get("user_id"):
        contact = await _client_contact(pkg["user_id"])
        if contact:
            await notify_event(
                "package_received", "PACKAGE", pid, to_email=contact["email"], user_id=pkg["user_id"],
                ctx={"name": contact["name"], "reference": pkg.get("reference"),
                     "weight": str(to_decimal(pkg.get("billable_weight_kg")) or "—"),
                     "status_label": STATUS_LABELS["PACKAGE"].get(pkg.get("status"), pkg.get("status"))},
            )
        await push_to_user(pkg["user_id"], "Colis reçu",
                           f"Votre colis {pkg.get('reference')} est arrivé au hub.", "/client/parcels")
    elif pkg.get("status") == "UNIDENTIFIED":
        admin_email = os.environ.get("ADMIN_EMAIL")
        if admin_email:
            await notify_event(
                "package_unidentified", "PACKAGE", pid, to_email=admin_email,
                ctx={"reference": pkg.get("reference")},
            )
    return serialize(await db.packages.find_one({"_id": oid(pid)}))


@api.post("/admin/packages/{pid}/attach")
async def admin_attach(pid: str, body: AttachIn, user=Depends(require_roles("ADMIN", "OPERATOR"))):
    pkg = await db.packages.find_one({"_id": oid(pid)})
    if not pkg:
        raise HTTPException(status_code=404, detail="Colis introuvable")
    if pkg.get("status") != "UNIDENTIFIED":
        raise HTTPException(status_code=409, detail="Ce colis n'est pas à identifier")
    fwd = await db.forwarding_addresses.find_one({"customer_reference": body.customer_reference.strip().upper()})
    if not fwd:
        raise HTTPException(status_code=404, detail="Référence client introuvable")
    await db.packages.update_one({"_id": oid(pid)}, {"$set": {"user_id": fwd["user_id"], "forwarding_address_id": str(fwd["_id"]), "hub_id": pkg.get("hub_id") or fwd.get("hub_id"), "updated_at": now_utc()}})
    await write_audit(user["id"], "PACKAGE_ATTACH", "PACKAGE", pid, {"user_id": None}, {"user_id": fwd["user_id"]})
    await transition_status("PACKAGE", pid, "RECEIVED", user["id"], "Rattachement client")
    return serialize(await db.packages.find_one({"_id": oid(pid)}))


@api.post("/admin/packages/{pid}/photos")
async def admin_upload_photo(pid: str, file: UploadFile = File(...), user=Depends(require_roles("ADMIN", "OPERATOR"))):
    if not await db.packages.find_one({"_id": oid(pid)}):
        raise HTTPException(status_code=404, detail="Colis introuvable")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Photo trop lourde (max 5 Mo)")
    await db.package_photos.insert_one({
        "package_id": pid, "data": base64.b64encode(data).decode(),
        "content_type": file.content_type or "image/jpeg",
        "storage_path": f"packages/{pid}/{secrets.token_hex(8)}", "created_at": now_utc(),
    })
    return {"ok": True}


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


@api.get("/admin/shipments/{sid}")
async def admin_shipment_detail(sid: str, user=Depends(require_roles("ADMIN"))):
    ship = await db.shipments.find_one({"_id": oid(sid)})
    if not ship:
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    out = serialize(ship)
    links = [l["package_id"] async for l in db.shipment_packages.find({"shipment_id": sid})]
    pkgs = []
    for pid in links:
        p = await db.packages.find_one({"_id": oid(pid)})
        if p:
            pkgs.append(serialize(p))
    out["packages"] = pkgs
    if ship.get("user_id"):
        prof = await db.profiles.find_one({"_id": oid(ship["user_id"])})
        out["client"] = serialize(prof) if prof else None
    out["payments"] = serialize(await db.payments.find({"shipment_id": sid}).to_list(50))
    out["costs"] = serialize(await db.cost_records.find({"shipment_id": sid}).to_list(50))
    out["tracking"] = serialize(await db.tracking_events.find({"shipment_id": sid}).sort("occurred_at", 1).to_list(200))
    out["history"] = serialize(await db.status_history.find({"entity_type": "SHIPMENT", "entity_id": sid}).sort("created_at", 1).to_list(200))
    return out


@api.put("/admin/shipments/{sid}")
async def admin_update_shipment(sid: str, body: ShipmentUpdateIn, user=Depends(require_roles("ADMIN"))):
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    if changes:
        await db.shipments.update_one({"_id": oid(sid)}, {"$set": {**changes, "updated_at": now_utc()}})
    return serialize(await db.shipments.find_one({"_id": oid(sid)}))


async def _try_pkg(pid, target, actor):
    try:
        await transition_status("PACKAGE", pid, target, actor, "Suivi expédition")
    except HTTPException:
        pass


@api.post("/admin/shipments/{sid}/transition")
async def admin_ship_transition(sid: str, body: TransitionIn, user=Depends(require_roles("ADMIN"))):
    ship = await db.shipments.find_one({"_id": oid(sid)})
    if not ship:
        raise HTTPException(status_code=404, detail="Expédition introuvable")
    if body.to_status == "PREPARING":
        paid = await db.payments.find_one({"shipment_id": sid, "status": "PAID"})
        if not paid:
            raise HTTPException(status_code=409, detail="Un paiement PAID est requis avant la préparation")
    await transition_status("SHIPMENT", sid, body.to_status, user["id"], body.reason)
    await db.tracking_events.insert_one({
        "shipment_id": sid, "status": body.to_status, "location": None,
        "message": STATUS_LABELS["SHIPMENT"].get(body.to_status, body.to_status),
        "occurred_at": now_utc().isoformat(), "created_at": now_utc(),
    })
    links = [l["package_id"] async for l in db.shipment_packages.find({"shipment_id": sid})]
    if body.to_status == "SHIPPED":
        for pid in links:
            await _try_pkg(pid, "READY_TO_SHIP", user["id"])
            await _try_pkg(pid, "SHIPPED", user["id"])
    elif body.to_status == "ARRIVED_BENIN":
        for pid in links:
            await _try_pkg(pid, "ARRIVED_BENIN", user["id"])
    elif body.to_status == "DELIVERED":
        for pid in links:
            await _try_pkg(pid, "DELIVERED", user["id"])
    contact = await _client_contact(ship.get("user_id"))
    if contact and body.to_status in ("SHIPPED", "ARRIVED_BENIN", "DELIVERED"):
        ev = {"SHIPPED": "shipment_created", "ARRIVED_BENIN": "arrived_benin", "DELIVERED": "delivered"}[body.to_status]
        await notify_event(
            ev, "SHIPMENT", f"{sid}:{body.to_status}", to_email=contact["email"], user_id=ship.get("user_id"),
            ctx={"name": contact["name"], "reference": ship.get("reference"), "sid": sid,
                 "tracking_number": ship.get("tracking_number") or "—"},
        )
    if body.to_status in ("SHIPPED", "ARRIVED_BENIN", "DELIVERED"):
        pmsg = {
            "SHIPPED": ("Expédition en route", f"{ship.get('reference')} a été expédiée."),
            "ARRIVED_BENIN": ("Arrivé au Bénin", f"{ship.get('reference')} est arrivé au Bénin."),
            "DELIVERED": ("Colis livré", f"{ship.get('reference')} a été livré."),
        }[body.to_status]
        await push_to_user(ship.get("user_id"), pmsg[0], pmsg[1], f"/client/shipments/{sid}")
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


# ============ ADMIN : tableau de bord & marge ============
from datetime import datetime


def _week_start():
    n = now_utc()
    return (n - timedelta(days=n.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def _month_start():
    return now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _parse_dt(v, default):
    if not v:
        return default
    try:
        return datetime.fromisoformat(v).replace(tzinfo=timezone.utc)
    except Exception:
        return default


@api.get("/admin/dashboard/metrics")
async def admin_dashboard_metrics(user=Depends(require_roles("ADMIN", "OPERATOR"))):
    """Indicateurs opérationnels (visibles ADMIN + OPERATOR, aucun montant)."""
    ws = _week_start()
    received_week = await db.packages.count_documents({"received_at": {"$gte": ws}})
    to_identify = await db.packages.count_documents({"status": "UNIDENTIFIED"})
    in_stock = await db.packages.count_documents({"status": "STORED"})
    shipments_by_status = {}
    for s in await db.shipments.find({}, {"status": 1}).to_list(2000):
        st = s.get("status", "DRAFT")
        shipments_by_status[st] = shipments_by_status.get(st, 0) + 1
    return {
        "received_this_week": received_week,
        "to_identify": to_identify,
        "in_stock": in_stock,
        "shipments_by_status": shipments_by_status,
    }


@api.get("/admin/dashboard/todo")
async def admin_dashboard_todo(user=Depends(require_roles("ADMIN", "OPERATOR"))):
    """À traiter aujourd'hui (ADMIN + OPERATOR)."""
    unidentified = serialize(await db.packages.find({"status": "UNIDENTIFIED"}).sort("created_at", -1).to_list(50))
    awaiting_prep = serialize(await db.shipments.find({"status": "PAID"}).sort("created_at", -1).to_list(50))
    incidents = serialize(await db.shipments.find({"status": "INCIDENT"}).sort("created_at", -1).to_list(50))
    return {"unidentified": unidentified, "awaiting_preparation": awaiting_prep, "incidents": incidents}


@api.get("/admin/dashboard/finance")
async def admin_dashboard_finance(user=Depends(require_roles("ADMIN"))):
    """Paiements & chiffre d'affaires (ADMIN uniquement ; OPERATOR interdit → 403)."""
    ms = _month_start()
    rate = to_decimal(await get_setting("eur_xof_rate", 655.957))
    paid = await db.payments.find({"status": "PAID"}).to_list(5000)
    payments_received = len(paid)
    revenue_month_xof = Decimal("0")
    for p in paid:
        pa = p.get("paid_at") or p.get("created_at")
        if isinstance(pa, datetime):
            if pa.tzinfo is None:
                pa = pa.replace(tzinfo=timezone.utc)
            if pa >= ms:
                revenue_month_xof += to_decimal(p.get("amount")) or Decimal("0")
    revenue_month_eur = revenue_month_xof / rate if rate else Decimal("0")
    return {
        "payments_received": payments_received,
        "revenue_month_xof": _q2(revenue_month_xof),
        "revenue_month_eur": _q2(revenue_month_eur),
        "eur_xof_rate": str(rate),
    }


@api.get("/admin/dashboard/margin")
async def admin_dashboard_margin(
    date_from: str = Query(None), date_to: str = Query(None),
    user=Depends(require_roles("ADMIN")),
):
    """Marge brute par expédition = revenus (payé) − coûts réels (ADMIN uniquement)."""
    start = _parse_dt(date_from, _month_start())
    end = _parse_dt(date_to, now_utc())
    if end.hour == 0 and end.minute == 0:
        end = end.replace(hour=23, minute=59, second=59)
    rate = to_decimal(await get_setting("eur_xof_rate", 655.957))
    shipments = await db.shipments.find({"created_at": {"$gte": start, "$lte": end}}).to_list(5000)
    rows = []
    tot_rev = tot_cost = tot_margin = tot_weight = Decimal("0")
    for s in shipments:
        sid = str(s["_id"])
        snap = s.get("tariff_snapshot") or {}
        srate = to_decimal(snap.get("eur_xof_rate")) or rate
        rev_eur = Decimal("0")
        for p in await db.payments.find({"shipment_id": sid, "status": "PAID"}).to_list(50):
            amt = to_decimal(p.get("amount")) or Decimal("0")
            rev_eur += amt / srate if (p.get("currency") == "XOF" and srate) else amt
        cost_eur = Decimal("0")
        for c in await db.cost_records.find({"shipment_id": sid}).to_list(100):
            amt = to_decimal(c.get("amount")) or Decimal("0")
            cost_eur += amt / rate if (c.get("currency") == "XOF" and rate) else amt
        weight = to_decimal(s.get("total_billable_weight_kg")) or Decimal("0")
        margin = rev_eur - cost_eur
        tot_rev += rev_eur
        tot_cost += cost_eur
        tot_margin += margin
        tot_weight += weight
        rows.append({
            "shipment_id": sid, "reference": s.get("reference"), "status": s.get("status"),
            "revenue_eur": _q2(rev_eur), "cost_eur": _q2(cost_eur), "margin_eur": _q2(margin),
            "billable_weight_kg": _q2(weight),
        })
    n = len(shipments)
    avg_margin = tot_margin / n if n else Decimal("0")
    cost_per_kg = tot_cost / tot_weight if tot_weight else Decimal("0")
    return {
        "date_from": start.isoformat(), "date_to": end.isoformat(), "count": n,
        "total_revenue_eur": _q2(tot_rev), "total_cost_eur": _q2(tot_cost),
        "total_margin_eur": _q2(tot_margin), "total_margin_xof": _q2(tot_margin * rate),
        "average_margin_eur": _q2(avg_margin), "cost_per_kg_eur": _q2(cost_per_kg),
        "rows": rows,
    }


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
