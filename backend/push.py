import os
import json
import asyncio
import logging

from pywebpush import webpush, WebPushException

from db import db
from core import now_utc

logger = logging.getLogger("baobab.push")

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@baobabcargo.app")


def _send_one(info, payload):
    webpush(
        subscription_info=info,
        data=payload,
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims={"sub": VAPID_SUBJECT},
    )


async def push_to_user(user_id, title, body, url="/client"):
    """Notification Web Push (best-effort) vers tous les appareils abonnés d'un client."""
    if not user_id or not VAPID_PRIVATE_KEY:
        return
    subs = await db.push_subscriptions.find({"user_id": user_id}).to_list(50)
    if not subs:
        return
    payload = json.dumps({"title": title, "body": body, "url": url})
    for s in subs:
        info = s.get("subscription")
        try:
            await asyncio.to_thread(_send_one, info, payload)
        except WebPushException as e:
            code = getattr(e.response, "status_code", None)
            if code in (404, 410):
                await db.push_subscriptions.delete_one({"_id": s["_id"]})
            else:
                logger.warning("Push échoué (%s)", code)
        except Exception as e:
            logger.warning("Push erreur: %s", str(e)[:120])
