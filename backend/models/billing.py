"""
Pydantic v2 models for Vyastha billing, plans, subscriptions and payments.

These models are the backend source of truth for billing API payloads.
Keep the corresponding TypeScript types synchronized with:
frontend/src/lib/billing-types.ts
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# TYPES
# ---------------------------------------------------------------------------

BillingCycle = Literal["monthly", "yearly"]

SubscriptionStatus = Literal[
    "trialing",
    "active",
    "pending",
    "past_due",
    "cancelled",
    "expired",
    "paused",
]

PaymentStatus = Literal[
    "paid",
    "failed",
    "pending",
    "refunded",
]


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _now() -> datetime:
    """Return the current UTC timestamp."""
    return datetime.now(timezone.utc)


def _uid() -> str:
    """Generate a UUID string."""
    return str(uuid.uuid4())


def _normalize_slug(value: str) -> str:
    """Normalize plan slugs before storing/processing them."""
    return value.strip().lower()


# ---------------------------------------------------------------------------
# PLAN
# ---------------------------------------------------------------------------

class Plan(BaseModel):
    """Subscription plan configuration."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=_uid)
    name: str = Field(min_length=1)
    slug: str = Field(min_length=1)
    description: str = ""

    monthly_price: float = Field(default=0, ge=0)
    yearly_price: float = Field(default=0, ge=0)

    currency: str = Field(default="INR", min_length=3, max_length=3)

    features: dict[str, bool] = Field(default_factory=dict)
    limits: dict[str, int] = Field(default_factory=dict)
    feature_list: list[str] = Field(default_factory=list)

    highlight: bool = False
    active: bool = True
    rank: int = Field(default=0, ge=0)

    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        return _normalize_slug(value)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return value.strip().upper()


# ---------------------------------------------------------------------------
# PLAN UPDATE
# ---------------------------------------------------------------------------

class PlanUpdate(BaseModel):
    """Fields that a platform admin can update on a plan."""

    model_config = ConfigDict(extra="forbid")

    monthly_price: float | None = Field(default=None, ge=0)
    yearly_price: float | None = Field(default=None, ge=0)

    active: bool | None = None

    limits: dict[str, int] | None = None

    @field_validator("limits")
    @classmethod
    def validate_limits(
        cls,
        value: dict[str, int] | None,
    ) -> dict[str, int] | None:
        if value is None:
            return None

        for key, limit in value.items():
            # -1 means unlimited.
            if limit < -1:
                raise ValueError(
                    f"Invalid limit for '{key}'. "
                    "Use -1 for unlimited or a non-negative number."
                )

        return value


# ---------------------------------------------------------------------------
# SUBSCRIPTION
# ---------------------------------------------------------------------------

class Subscription(BaseModel):
    """User/business subscription record."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=_uid)

    user_id: str
    business_id: str

    plan_id: str
    plan_slug: str

    billing_cycle: BillingCycle
    status: SubscriptionStatus = "pending"

    amount: float = Field(default=0, ge=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)

    razorpay_customer_id: str | None = None
    razorpay_subscription_id: str | None = None
    razorpay_plan_id: str | None = None

    current_period_start: datetime | None = None
    current_period_end: datetime | None = None

    cancel_at_period_end: bool = False
    cancelled_at: datetime | None = None

    pending_plan_slug: str | None = None

    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    @field_validator("plan_slug")
    @classmethod
    def validate_plan_slug(cls, value: str) -> str:
        return _normalize_slug(value)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return value.strip().upper()


# ---------------------------------------------------------------------------
# PAYMENT
# ---------------------------------------------------------------------------

class Payment(BaseModel):
    """Payment transaction record."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=_uid)

    user_id: str
    business_id: str

    subscription_id: str | None = None
    plan_slug: str | None = None

    razorpay_payment_id: str | None = None
    razorpay_order_id: str | None = None
    razorpay_subscription_id: str | None = None
    razorpay_invoice_id: str | None = None

    amount: float = Field(default=0, ge=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)

    status: PaymentStatus = "pending"

    payment_method: str | None = None
    failure_reason: str | None = None

    paid_at: datetime | None = None

    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    @field_validator("plan_slug")
    @classmethod
    def validate_plan_slug(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None
        return _normalize_slug(value)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return value.strip().upper()


# ===========================================================================
# AUTH / REQUEST MODELS
# ===========================================================================

class SignupRequest(BaseModel):
    """New Vyastha account registration payload."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    business_name: str = Field(min_length=1)

    @field_validator("name", "business_name")
    @classmethod
    def validate_names(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("This field cannot be empty.")

        return value


class LoginRequest(BaseModel):
    """Login request payload."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1)


# ===========================================================================
# USER / BUSINESS RESPONSE MODELS
# ===========================================================================

class BusinessOut(BaseModel):
    """Public business information."""

    id: str
    name: str


class UserOut(BaseModel):
    """Public authenticated user information."""

    id: str
    email: EmailStr
    name: str
    role: str

    is_platform_admin: bool = False

    business: BusinessOut


# ===========================================================================
# SUBSCRIPTION RESPONSE MODELS
# ===========================================================================

class EntitlementsOut(BaseModel):
    """Resolved subscription permissions and limits."""

    plan_slug: str
    plan_name: str

    status: SubscriptionStatus

    features: dict[str, bool] = Field(default_factory=dict)
    limits: dict[str, int] = Field(default_factory=dict)

    in_grace_period: bool = False


class SubscriptionOut(BaseModel):
    """Current subscription information returned to the frontend."""

    subscription: Subscription | None = None

    plan: Plan

    entitlements: EntitlementsOut

    # Public Razorpay key only.
    # NEVER expose RAZORPAY_KEY_SECRET here.
    razorpay_key_id: str | None = None

    gateway_configured: bool = False


# ===========================================================================
# SUBSCRIPTION REQUEST / RESPONSE
# ===========================================================================

class CreateSubscriptionRequest(BaseModel):
    """Request to create a Razorpay subscription."""

    model_config = ConfigDict(extra="forbid")

    plan_slug: str = Field(min_length=1)
    billing_cycle: BillingCycle

    @field_validator("plan_slug")
    @classmethod
    def validate_plan_slug(cls, value: str) -> str:
        return _normalize_slug(value)


class CreateSubscriptionResponse(BaseModel):
    """Response required by the frontend to open Razorpay Checkout."""

    subscription_id: str
    razorpay_subscription_id: str

    # Public key only.
    razorpay_key_id: str

    amount: float = Field(ge=0)
    currency: str

    plan_name: str
    billing_cycle: BillingCycle

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return value.strip().upper()


class VerifyPaymentRequest(BaseModel):
    """Razorpay subscription payment verification payload."""

    model_config = ConfigDict(extra="forbid")

    razorpay_payment_id: str = Field(min_length=1)
    razorpay_subscription_id: str = Field(min_length=1)
    razorpay_signature: str = Field(min_length=1)


class ActionResult(BaseModel):
    """Generic API action response."""

    ok: bool
    message: str
    status: str | None = None


class ChangePlanRequest(BaseModel):
    """Request to change an existing subscription plan."""

    model_config = ConfigDict(extra="forbid")

    plan_slug: str = Field(min_length=1)
    billing_cycle: BillingCycle

    @field_validator("plan_slug")
    @classmethod
    def validate_plan_slug(cls, value: str) -> str:
        return _normalize_slug(value)


# ===========================================================================
# ADMIN
# ===========================================================================

class AdminStats(BaseModel):
    """Platform-level subscription statistics."""

    total_subscribers: int = Field(default=0, ge=0)
    active: int = Field(default=0, ge=0)
    cancelled: int = Field(default=0, ge=0)
    expired: int = Field(default=0, ge=0)
    past_due: int = Field(default=0, ge=0)

    failed_payments: int = Field(default=0, ge=0)

    revenue_total: float = Field(default=0, ge=0)
    revenue_currency: str = "INR"

    plan_counts: dict[str, int] = Field(default_factory=dict)

    @field_validator("revenue_currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return value.strip().upper()


# ===========================================================================
# WEBHOOK
# ===========================================================================

class WebhookAck(BaseModel):
    """Response returned after processing a Razorpay webhook."""

    status: str
    event: str | None = None
    detail: str | None = None


# ===========================================================================
# MONGODB HELPERS
# ===========================================================================

def clean(doc: dict[str, Any]) -> dict[str, Any]:
    """
    Prepare a MongoDB document for API/Pydantic usage.

    MongoDB uses _id, while the application uses id.

    This function does NOT mutate the original MongoDB dictionary.
    """
    result = dict(doc)

    result.pop("_id", None)

    return result