import os
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
from bson import ObjectId, Decimal128
from fastapi import HTTPException


def now_utc():
    return datetime.now(timezone.utc)


def to_money(value):
    """Convertit une valeur en Decimal128 exact (numeric(12,2))."""
    if value is None:
        return None
    d = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return Decimal128(d)


def to_decimal(value):
    """Decimal128/valeur -> Decimal (précision libre, pour les calculs et taux)."""
    if value is None:
        return None
    if isinstance(value, Decimal128):
        return value.to_decimal()
    return Decimal(str(value))


def to_num(value):
    """Stocke un nombre à précision libre (ex: taux 655.957) en Decimal128."""
    if value is None:
        return None
    return Decimal128(Decimal(str(value)))


def oid(value):
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Identifiant invalide")


def serialize(doc):
    """Sérialise récursivement pour l'API : _id->id, Decimal128/Decimal->str, dates ISO."""
    if isinstance(doc, list):
        return [serialize(x) for x in doc]
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            out["id" if k == "_id" else k] = serialize(v)
        return out
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, Decimal128):
        return str(doc.to_decimal())
    if isinstance(doc, Decimal):
        return str(doc)
    if isinstance(doc, datetime):
        if doc.tzinfo is None:
            doc = doc.replace(tzinfo=timezone.utc)
        return doc.astimezone(timezone.utc).isoformat()
    return doc
