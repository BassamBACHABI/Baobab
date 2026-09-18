import random
import string
from bson import ObjectId
from fastapi import HTTPException

from core import now_utc
from db import db
from security import hash_password


def _rand(n):
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=n))


async def gen_reference(prefix: str, coll, length: int = 6) -> str:
    for _ in range(20):
        ref = f"{prefix}-{_rand(length)}"
        if not await coll.find_one({"reference": ref}):
            return ref
    raise HTTPException(status_code=500, detail="Impossible de générer une référence")


async def gen_customer_reference() -> str:
    for _ in range(20):
        ref = f"CLB-{_rand(6)}"
        if not await db.forwarding_addresses.find_one({"customer_reference": ref}):
            return ref
    raise HTTPException(status_code=500, detail="Référence client indisponible")


async def _active_hub_id():
    hub = await db.logistic_hubs.find_one({"active": True})
    if not hub:
        raise HTTPException(
            status_code=503,
            detail="Aucun hub actif n'est disponible pour le moment.",
        )
    return str(hub["_id"])


async def create_account(
    *,
    email: str,
    password: str | None,
    first_name: str = "",
    last_name: str = "",
    phone: str | None = None,
    role: str = "CLIENT",
    provider: str = "password",
    provider_sub: str | None = None,
    with_forwarding: bool = True,
    name: str | None = None,
    picture: str | None = None,
):
    """Trigger d'inscription : profil + rôle + (adresse de réception pour les clients)."""
    email = email.strip().lower()
    if await db.auth_users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Cet e-mail est déjà utilisé.")

    user_oid = ObjectId()
    uid = str(user_oid)
    display = name or f"{first_name} {last_name}".strip() or email.split("@")[0]

    await db.auth_users.insert_one(
        {
            "_id": user_oid,
            "email": email,
            "password_hash": hash_password(password) if password else None,
            "name": display,
            "picture": picture,
            "provider": provider,
            "provider_sub": provider_sub,
            "created_at": now_utc(),
        }
    )
    await db.profiles.insert_one(
        {
            "_id": user_oid,
            "first_name": first_name,
            "last_name": last_name,
            "phone": phone,
            "email": email,
            "status": "ACTIVE",
            "created_at": now_utc(),
        }
    )
    await db.user_roles.insert_one(
        {"user_id": uid, "role": role, "created_at": now_utc()}
    )

    if with_forwarding and role == "CLIENT":
        await db.forwarding_addresses.insert_one(
            {
                "hub_id": await _active_hub_id(),
                "user_id": uid,
                "customer_reference": await gen_customer_reference(),
                "active": True,
                "created_at": now_utc(),
            }
        )
    return uid


async def ensure_social_user(provider: str, sub: str, email: str | None, name: str | None, picture: str | None = None):
    """Upsert d'un compte social — clé d'identité = (provider, sub), pas l'e-mail.
    Déclenche le trigger d'inscription (profil + rôle CLIENT + forwarding_address) si nouveau."""
    email = (email or "").strip().lower()
    existing = None
    if sub:
        existing = await db.auth_users.find_one({"provider": provider, "provider_sub": sub})
    if not existing and email:
        existing = await db.auth_users.find_one({"email": email})
    if existing:
        patch = {"provider": provider, "provider_sub": sub}
        if name:
            patch["name"] = name
        if picture:
            patch["picture"] = picture
        await db.auth_users.update_one({"_id": existing["_id"]}, {"$set": patch})
        return str(existing["_id"])
    parts = (name or "").split(" ", 1)
    first = parts[0] if parts else ""
    last = parts[1] if len(parts) > 1 else ""
    if not email:
        # Apple peut masquer l'e-mail (relais privé absent) : identifiant interne stable.
        email = f"{provider}_{sub}@users.baobabcargo.app"
    return await create_account(
        email=email, password=None, first_name=first, last_name=last,
        role="CLIENT", provider=provider, provider_sub=sub,
        with_forwarding=True, name=name, picture=picture,
    )


async def ensure_google_user(email: str, name: str, picture: str | None, sub: str | None = None):
    return await ensure_social_user("google", sub or email, email, name, picture)
