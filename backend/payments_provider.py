import os


class PaymentProvider:
    """Abstraction : à remplacer par un vrai prestataire (mobile money / carte)
    sans toucher au reste du code."""

    name = "base"

    def initiate(self, payment_id: str, amount, currency: str) -> dict:
        raise NotImplementedError

    def verify_webhook(self, provided_secret: str) -> bool:
        raise NotImplementedError


class SimulationProvider(PaymentProvider):
    name = "simulation"

    def initiate(self, payment_id: str, amount, currency: str) -> dict:
        return {"provider": self.name, "checkout_ref": f"SIM-{payment_id}", "amount": str(amount), "currency": currency}

    def verify_webhook(self, provided_secret: str) -> bool:
        expected = os.environ.get("PAYMENT_WEBHOOK_SECRET", "")
        return bool(expected) and provided_secret == expected


provider = SimulationProvider()
