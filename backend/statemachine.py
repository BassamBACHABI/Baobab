from fastapi import HTTPException
from bson import ObjectId

from core import now_utc, serialize
from db import db

# ---- Transitions autorisées (codes EN) ----
PACKAGE_TRANSITIONS = {
    "EXPECTED": ["RECEIVED", "UNIDENTIFIED", "REFUSED"],
    "UNIDENTIFIED": ["RECEIVED", "REFUSED"],
    "RECEIVED": ["INSPECTED", "DAMAGED"],
    "INSPECTED": ["STORED", "DAMAGED"],
    "STORED": ["READY_TO_SHIP", "DAMAGED"],
    "READY_TO_SHIP": ["SHIPPED", "STORED"],
    "SHIPPED": ["ARRIVED_BENIN"],
    "ARRIVED_BENIN": ["DELIVERED", "RETURNED"],
    "DAMAGED": ["STORED", "REFUSED", "RETURNED"],
    "REFUSED": ["RETURNED"],
    "DELIVERED": [],
    "RETURNED": [],
}

SHIPMENT_TRANSITIONS = {
    "DRAFT": ["AWAITING_PAYMENT", "INCIDENT"],
    "AWAITING_PAYMENT": ["PAID", "INCIDENT"],
    "PAID": ["PREPARING", "INCIDENT"],
    "PREPARING": ["SHIPPED", "INCIDENT"],
    "SHIPPED": ["IN_TRANSIT", "INCIDENT"],
    "IN_TRANSIT": ["ARRIVED_BENIN", "INCIDENT"],
    "ARRIVED_BENIN": ["OUT_FOR_DELIVERY", "INCIDENT"],
    "OUT_FOR_DELIVERY": ["DELIVERED", "INCIDENT"],
    "INCIDENT": ["IN_TRANSIT", "ARRIVED_BENIN", "OUT_FOR_DELIVERY", "DELIVERED"],
    "DELIVERED": [],
}

PAYMENT_TRANSITIONS = {
    "PENDING": ["AUTHORIZED", "PAID", "FAILED", "CANCELLED"],
    "AUTHORIZED": ["PAID", "FAILED", "CANCELLED"],
    "PAID": ["REFUNDED"],
    "FAILED": [],
    "CANCELLED": [],
    "REFUNDED": [],
}

MACHINES = {
    "PACKAGE": ("packages", PACKAGE_TRANSITIONS),
    "SHIPMENT": ("shipments", SHIPMENT_TRANSITIONS),
    "PAYMENT": ("payments", PAYMENT_TRANSITIONS),
}

# ---- Libellés FR (affichage) ----
STATUS_LABELS = {
    "PACKAGE": {
        "EXPECTED": "Attendu", "RECEIVED": "Reçu", "UNIDENTIFIED": "Non identifié",
        "INSPECTED": "Inspecté", "STORED": "Stocké", "READY_TO_SHIP": "Prêt à expédier",
        "SHIPPED": "Expédié", "ARRIVED_BENIN": "Arrivé au Bénin", "DELIVERED": "Livré",
        "DAMAGED": "Endommagé", "REFUSED": "Refusé", "RETURNED": "Retourné",
    },
    "SHIPMENT": {
        "DRAFT": "Brouillon", "AWAITING_PAYMENT": "En attente de paiement", "PAID": "Payé",
        "PREPARING": "En préparation", "SHIPPED": "Expédié", "IN_TRANSIT": "En transit",
        "ARRIVED_BENIN": "Arrivé au Bénin", "OUT_FOR_DELIVERY": "En cours de livraison",
        "DELIVERED": "Livré", "INCIDENT": "Incident",
    },
    "PAYMENT": {
        "PENDING": "En attente", "AUTHORIZED": "Autorisé", "PAID": "Payé",
        "FAILED": "Échoué", "REFUNDED": "Remboursé", "CANCELLED": "Annulé",
    },
}

SENSITIVE_AUDIT = {"SHIPMENT", "PAYMENT"}


async def write_audit(actor_id, action, entity_type, entity_id, before, after):
    await db.audit_log.insert_one(
        {
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "before": serialize(before) if before else None,
            "after": serialize(after) if after else None,
            "created_at": now_utc(),
        }
    )


async def transition_status(entity_type, entity_id, to_status, actor_id, reason=None):
    """Transition serveur uniquement : vérifie, journalise status_history, refuse sinon."""
    if entity_type not in MACHINES:
        raise HTTPException(status_code=400, detail="Type d'entité inconnu")
    coll_name, table = MACHINES[entity_type]
    coll = db[coll_name]
    doc = await coll.find_one({"_id": ObjectId(entity_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Entité introuvable")

    frm = doc.get("status")
    allowed = table.get(frm, [])
    if to_status not in table:
        raise HTTPException(status_code=400, detail="Statut cible invalide")
    if to_status not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"Transition non autorisée : {frm} → {to_status}",
        )

    await coll.update_one(
        {"_id": ObjectId(entity_id)},
        {"$set": {"status": to_status, "updated_at": now_utc()}},
    )
    await db.status_history.insert_one(
        {
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "from_status": frm,
            "to_status": to_status,
            "actor_id": actor_id,
            "reason": reason,
            "created_at": now_utc(),
        }
    )
    if entity_type in SENSITIVE_AUDIT:
        await write_audit(
            actor_id, f"{entity_type}_STATUS_CHANGE", entity_type, entity_id,
            {"status": frm}, {"status": to_status},
        )
    return frm, to_status
