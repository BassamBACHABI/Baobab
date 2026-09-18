import os
import jwt
import bcrypt
from datetime import timedelta
from fastapi import Request, HTTPException, Depends

from core import now_utc, oid
from db import db

JWT_ALG = "HS256"
ACCESS_TTL_DAYS = 7
MAX_ATTEMPTS = 5
LOCK_MINUTES = 15


def _secret():
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "access",
        "exp": now_utc() + timedelta(days=ACCESS_TTL_DAYS),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALG)


# ---- Brute force protection ----
async def check_lockout(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if not rec:
        return
    if rec.get("count", 0) >= MAX_ATTEMPTS:
        locked_until = rec.get("locked_until")
        if locked_until and locked_until.tzinfo is None:
            from datetime import timezone
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until and locked_until > now_utc():
            raise HTTPException(
                status_code=429,
                detail="Trop de tentatives. Réessayez dans quelques minutes.",
            )


async def record_failure(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    count = (rec.get("count", 0) if rec else 0) + 1
    update = {"count": count, "updated_at": now_utc()}
    if count >= MAX_ATTEMPTS:
        update["locked_until"] = now_utc() + timedelta(minutes=LOCK_MINUTES)
    await db.login_attempts.update_one(
        {"identifier": identifier}, {"$set": update}, upsert=True
    )


async def clear_attempts(identifier: str):
    await db.login_attempts.delete_one({"identifier": identifier})


# ---- Roles (table séparée user_roles) ----
async def get_roles(user_id: str):
    return [r["role"] async for r in db.user_roles.find({"user_id": user_id})]


async def has_role(user_id: str, role: str) -> bool:
    """Fonction serveur de confiance (équivalent has_role SECURITY DEFINER)."""
    return (
        await db.user_roles.find_one({"user_id": user_id, "role": role}) is not None
    )


async def _load_user(user_id: str):
    auth = await db.auth_users.find_one({"_id": oid(user_id)})
    if not auth:
        return None
    profile = await db.profiles.find_one({"_id": oid(user_id)})
    roles = await get_roles(user_id)
    return {
        "id": user_id,
        "email": auth.get("email"),
        "name": auth.get("name"),
        "picture": auth.get("picture"),
        "provider": auth.get("provider"),
        "roles": roles,
        "profile_status": (profile or {}).get("status"),
    }


async def _resolve(request: Request):
    # 1) cookie session_token (Emergent Google) ; 2) Authorization Bearer ; 3) cookie access_token
    raw = request.cookies.get("session_token")
    if not raw:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            raw = auth_header[7:]
    if not raw:
        raw = request.cookies.get("access_token")
    if not raw:
        return None

    # Try Emergent session token first
    sess = await db.user_sessions.find_one({"session_token": raw})
    if sess:
        exp = sess.get("expires_at")
        if exp is not None:
            if exp.tzinfo is None:
                from datetime import timezone
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < now_utc():
                return None
        return await _load_user(sess["user_id"])

    # Fallback: JWT access token
    try:
        payload = jwt.decode(raw, _secret(), algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            return None
        return await _load_user(payload["sub"])
    except jwt.PyJWTError:
        return None


async def get_current_user(request: Request):
    user = await _resolve(request)
    if not user:
        raise HTTPException(status_code=401, detail="Non authentifié")
    return user


def require_roles(*roles):
    async def dep(user=Depends(get_current_user)):
        if not any(r in user["roles"] for r in roles):
            raise HTTPException(status_code=403, detail="Accès refusé")
        return user

    return dep


def is_admin(user) -> bool:
    return "ADMIN" in user["roles"]


def is_staff(user) -> bool:
    return "ADMIN" in user["roles"] or "OPERATOR" in user["roles"]
