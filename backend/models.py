from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, field_validator


# ---- Auth ----
class RegisterIn(BaseModel):
    first_name: str = ""
    last_name: str = ""
    phone: Optional[str] = None
    email: EmailStr
    password: str = Field(min_length=6)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class GoogleSessionIn(BaseModel):
    session_id: Optional[str] = None


# ---- Profile / addresses ----
class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


class AddressIn(BaseModel):
    country: str
    city: str
    address_line: str
    postal_code: Optional[str] = None
    landmark: Optional[str] = None
    type: str = "DELIVERY_BENIN"


# ---- Référentiels ----
class CountryIn(BaseModel):
    code: str
    name: str
    currency: str
    active: bool = True


class HubIn(BaseModel):
    country_id: str
    name: str
    address_line: str
    city: str
    postal_code: Optional[str] = None
    active: bool = True


class CarrierIn(BaseModel):
    name: str
    active: bool = True


class ZoneIn(BaseModel):
    name: str
    city: str
    delivery_mode: str  # PICKUP_POINT | HOME
    fee_xof: Decimal
    active: bool = True


class TariffIn(BaseModel):
    origin_country_id: str
    destination_country_code: str
    service_type: str = "FREIGHT_FORWARDING"
    transport_mode: str = "AIR"  # AIR | SEA
    min_weight_kg: Decimal
    max_weight_kg: Decimal
    price_per_kg: Decimal
    fixed_fee: Decimal = Decimal("0")
    currency: str = "EUR"
    active: bool = True
    valid_from: Optional[str] = None


class SettingIn(BaseModel):
    value: str


# ---- Colis ----
class PackageIn(BaseModel):
    customer_reference: Optional[str] = None  # rattachement client (sinon UNIDENTIFIED)
    hub_id: Optional[str] = None
    merchant_name: Optional[str] = None
    tracking_in: Optional[str] = None
    declared_value: Optional[Decimal] = None
    content_category: Optional[str] = None
    storage_location: Optional[str] = None
    notes: Optional[str] = None


class WeighIn(BaseModel):
    weight_kg: Decimal
    length_cm: Decimal
    width_cm: Decimal
    height_cm: Decimal


class PackageItemIn(BaseModel):
    description: str
    quantity: int = 1
    declared_unit_value: Decimal = Decimal("0")


class TransitionIn(BaseModel):
    to_status: str
    reason: Optional[str] = None


# ---- Expéditions ----
class ShipmentIn(BaseModel):
    package_ids: List[str] = []
    destination_country_code: str = "BJ"
    destination_city: str
    delivery_zone_id: Optional[str] = None
    delivery_mode: str = "PICKUP_POINT"
    carrier_id: Optional[str] = None
    transport_mode: str = "AIR"


class TrackingIn(BaseModel):
    status: str
    location: Optional[str] = None
    message: Optional[str] = None
    occurred_at: Optional[str] = None


# ---- Paiements / coûts ----
class PaymentIn(BaseModel):
    shipment_id: Optional[str] = None
    order_id: Optional[str] = None
    provider: str = "MANUAL"
    transaction_reference: Optional[str] = None
    amount: Decimal
    currency: str = "XOF"

    @field_validator("order_id")
    @classmethod
    def _xor(cls, v, info):
        # exactly one of shipment_id / order_id
        ship = info.data.get("shipment_id")
        if bool(ship) == bool(v):
            raise ValueError("Renseignez exactement une référence : shipment_id OU order_id")
        return v


class CostIn(BaseModel):
    shipment_id: Optional[str] = None
    package_id: Optional[str] = None
    type: str = "OTHER"  # CARRIER | PAYMENT_FEE | LOCAL_DELIVERY | INSURANCE | STORAGE | OTHER
    amount: Decimal
    currency: str = "EUR"
    notes: Optional[str] = None


class DeclareIn(BaseModel):
    merchant_name: str
    tracking_in: Optional[str] = None
    content_category: Optional[str] = None
    declared_value: Optional[Decimal] = None
    items: List[PackageItemIn] = []


class ReceiveIn(BaseModel):
    customer_reference: Optional[str] = None
    expected_package_id: Optional[str] = None
    hub_id: Optional[str] = None
    merchant_name: Optional[str] = None
    tracking_in: Optional[str] = None
    declared_value: Optional[Decimal] = None
    content_category: Optional[str] = None
    storage_location: Optional[str] = None
    notes: Optional[str] = None
    weight_kg: Optional[Decimal] = None
    length_cm: Optional[Decimal] = None
    width_cm: Optional[Decimal] = None
    height_cm: Optional[Decimal] = None
    auto_store: bool = True


class AttachIn(BaseModel):
    customer_reference: str


class QuoteIn(BaseModel):
    package_ids: List[str]
    delivery_zone_id: str
    delivery_mode: str = "PICKUP_POINT"
    transport_mode: str = "AIR"


class ShipmentUpdateIn(BaseModel):
    carrier_id: Optional[str] = None
    transport_mode: Optional[str] = None
    tracking_number: Optional[str] = None


class WebhookIn(BaseModel):
    payment_id: str
    result: str  # success | failure


class SimulateIn(BaseModel):
    result: str  # success | failure


class PrefIn(BaseModel):
    notify_non_essential: bool
