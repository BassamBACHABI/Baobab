import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from dotenv import load_dotenv

from db import db
from core import now_utc, oid

load_dotenv()
logger = logging.getLogger("baobab.email")

# Proxy e-mail géré par Emergent. Constante (jamais lue depuis l'env) pour survivre au déploiement.
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Baobab Transit")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "")

# ============ Garde-fou structurel (copié du playbook, appelé à chaque envoi) ============
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    if not EMAIL_KEY:
        raise RuntimeError("EMERGENT_EMAIL_KEY manquant")
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{EMAIL_BASE_URL}/api/v1/email/send",
            headers={"X-Email-Key": EMAIL_KEY},
            json=payload,
        )
    resp.raise_for_status()
    return resp.json().get("id")


# ============ Modèles français (marque Baobab Cargo) ============
def _link(path: str) -> str:
    base = FRONTEND_URL.rstrip("/")
    return f"{base}{path}"


def _wrap(heading: str, lines: list[str], cta_label=None, cta_path=None) -> str:
    brand = escape(EMAIL_FROM_NAME)
    paras = "".join(
        f'<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#243b53">{l}</p>'
        for l in lines
    )
    cta = ""
    if cta_label and cta_path:
        url = _link(cta_path)
        cta = (
            f'<div style="margin:20px 0 4px"><a href="{url}" '
            f'style="display:inline-block;background:#E56B3D;color:#ffffff;text-decoration:none;'
            f'padding:12px 22px;border-radius:10px;font-weight:600;font-size:14px">{escape(cta_label)}</a></div>'
        )
    return (
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        f'style="background:#f4f6fb;padding:24px 0"><tr><td align="center">'
        f'<table role="presentation" width="560" cellpadding="0" cellspacing="0" '
        f'style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;'
        f'font-family:Arial,Helvetica,sans-serif">'
        f'<tr><td style="background:#0B2046;padding:20px 28px">'
        f'<span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.3px">{brand}</span>'
        f'</td></tr>'
        f'<tr><td style="padding:28px">'
        f'<h1 style="margin:0 0 16px;font-size:20px;color:#0B2046">{escape(heading)}</h1>'
        f'{paras}{cta}'
        f'</td></tr>'
        f'<tr><td style="padding:18px 28px;background:#f4f6fb;font-size:12px;color:#829ab1;line-height:1.5">'
        f'Envoyé par {brand}. Nous ne vous demanderons jamais votre mot de passe ni vos '
        f'informations de paiement par e-mail.'
        f'</td></tr>'
        f'</table></td></tr></table>'
    )


def _render(event: str, ctx: dict):
    name = escape(str(ctx.get("name", "client")))
    ref = escape(str(ctx.get("reference", "")))
    if event == "package_received":
        return (
            f"Votre colis {ctx.get('reference','')} est arrivé au hub",
            _wrap(
                "Colis reçu au hub",
                [
                    f"Bonjour {name},",
                    f"Nous avons bien reçu votre colis <strong>{ref}</strong> à notre hub en Europe.",
                    f"Poids facturable : <strong>{escape(str(ctx.get('weight','—')))} kg</strong>. "
                    f"Statut : <strong>{escape(str(ctx.get('status_label','Reçu')))}</strong>.",
                    "Vous pouvez créer une expédition dès qu'il est stocké.",
                ],
                "Voir le colis", "/client/parcels",
            ),
        )
    if event == "package_unidentified":
        return (
            f"[Action] Colis à identifier {ctx.get('reference','')}",
            _wrap(
                "Colis reçu sans référence client",
                [
                    f"Un colis <strong>{ref}</strong> vient d'être réceptionné sans référence client.",
                    "Merci de le rattacher à un client depuis le back-office.",
                ],
                "Ouvrir le back-office", "/admin/parcels",
            ),
        )
    if event == "quote_ready":
        return (
            f"Devis d'expédition {ctx.get('reference','')} disponible",
            _wrap(
                "Votre devis est prêt",
                [
                    f"Bonjour {name},",
                    f"Le devis de votre expédition <strong>{ref}</strong> est disponible.",
                    f"Montant : <strong>{escape(str(ctx.get('total_eur','')))} € "
                    f"({escape(str(ctx.get('total_xof','')))} FCFA)</strong>.",
                    "Réglez le paiement pour lancer la préparation.",
                ],
                "Payer maintenant", f"/client/shipments/{escape(str(ctx.get('sid','')))}",
            ),
        )
    if event == "payment_confirmed":
        return (
            f"Paiement confirmé — expédition {ctx.get('reference','')}",
            _wrap(
                "Paiement confirmé",
                [
                    f"Bonjour {name},",
                    f"Nous confirmons la réception de votre paiement de "
                    f"<strong>{escape(str(ctx.get('amount','')))} {escape(str(ctx.get('currency','XOF')))}</strong> "
                    f"pour l'expédition <strong>{ref}</strong>.",
                    "Votre expédition va être préparée.",
                ],
                "Suivre l'expédition", f"/client/shipments/{escape(str(ctx.get('sid','')))}",
            ),
        )
    if event == "shipment_created":
        return (
            f"Expédition {ctx.get('reference','')} en route — n° {ctx.get('tracking_number','')}",
            _wrap(
                "Votre expédition est partie",
                [
                    f"Bonjour {name},",
                    f"Votre expédition <strong>{ref}</strong> a été expédiée.",
                    f"Numéro de suivi : <strong>{escape(str(ctx.get('tracking_number','—')))}</strong>.",
                ],
                "Suivre l'expédition", f"/client/shipments/{escape(str(ctx.get('sid','')))}",
            ),
        )
    if event == "arrived_benin":
        return (
            f"Votre expédition {ctx.get('reference','')} est arrivée au Bénin",
            _wrap(
                "Arrivée au Bénin",
                [
                    f"Bonjour {name},",
                    f"Bonne nouvelle : votre expédition <strong>{ref}</strong> est arrivée au Bénin.",
                    "Vous serez informé lors de la mise en livraison.",
                ],
                "Suivre l'expédition", f"/client/shipments/{escape(str(ctx.get('sid','')))}",
            ),
        )
    if event == "delivered":
        return (
            f"Expédition {ctx.get('reference','')} livrée",
            _wrap(
                "Colis livré",
                [
                    f"Bonjour {name},",
                    f"Votre expédition <strong>{ref}</strong> a été livrée. Merci de votre confiance !",
                ],
                "Voir mes expéditions", "/client/shipments",
            ),
        )
    raise ValueError(f"Événement e-mail inconnu : {event}")


# Événements non essentiels : soumis à la préférence client.
NON_ESSENTIAL = {"package_received", "quote_ready", "arrived_benin", "delivered"}


async def notify_event(event, entity_type, entity_id, *, to_email, ctx, user_id=None):
    """Envoi idempotent (event + entité) ; respecte la préférence client pour les e-mails non essentiels."""
    if not to_email:
        return
    key = {"event": event, "entity_type": entity_type, "entity_id": str(entity_id)}
    if await db.notifications.find_one(key):
        return
    if event in NON_ESSENTIAL and user_id:
        prof = await db.profiles.find_one({"_id": oid(user_id)})
        if prof and prof.get("notify_non_essential", True) is False:
            await db.notifications.insert_one({**key, "to": to_email, "status": "SKIPPED", "created_at": now_utc()})
            return
    subject, html = _render(event, ctx)
    status, email_id, err = "SENT", None, None
    try:
        email_id = await send_email(to=to_email, subject=subject, html=html)
    except Exception as e:
        status, err = "FAILED", str(e)
        logger.error("Échec envoi e-mail %s (%s): %s", event, entity_id, err)
    await db.notifications.insert_one({
        **key, "to": to_email, "status": status, "email_id": email_id,
        "error": err, "created_at": now_utc(),
    })
