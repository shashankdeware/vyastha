"""
Centralized subscription plan and feature configuration for Vyastha.

Prices are stored in MongoDB (plans collection) and are admin-configurable.
This module holds the DEFAULT seed values only. Never hard-code prices in
routers or frontend components.

Vyastha default pricing:
- Free trial: 90 days on the full (Pro) feature set, Rs.0
- Monthly plan: Rs.49 / month
- Yearly plan:  Rs.499 / year
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any


# All subscription feature keys the platform understands.
FEATURE_KEYS: tuple[str, ...] = (
    "invoicing",
    "quotations",
    "products",
    "inventory",
    "payment_tracking",
    "basic_analytics",
    "advanced_analytics",
    "advanced_inventory",
    "smart_features",
    "ai_business_assistant",
    "multi_user",
    "priority_support",
    "api_access",
    "export_reports",
    "whatsapp_sharing",
    "email_sharing",
    "voice_assistant",
)


PLAN_RANK: dict[str, int] = {
    "free": 0,
    "pro": 1,
}

FALLBACK_PLAN_SLUG = "free"

# Default free-trial length in days (admin-configurable via the Pro plan doc).
DEFAULT_TRIAL_DAYS = 90


_FREE_FEATURES = {
    "invoicing": True,
    "quotations": True,
    "products": True,
    "inventory": True,
    "payment_tracking": True,
    "basic_analytics": True,
    "email_sharing": True,
    "advanced_analytics": False,
    "advanced_inventory": False,
    "smart_features": False,
    "ai_business_assistant": False,
    "multi_user": False,
    "priority_support": False,
    "api_access": False,
    "export_reports": False,
    "whatsapp_sharing": False,
    "voice_assistant": False,
}


PLAN_DEFAULTS: list[dict[str, Any]] = [
    {
        "slug": "free",
        "name": "Free",
        "description": "Core billing for small businesses after the free trial ends.",
        "monthly_price": 0,
        "yearly_price": 0,
        "currency": "INR",
        "active": True,
        "highlight": False,
        "trial_days": 0,
        "features": dict(_FREE_FEATURES),
        "limits": {
            "invoices_per_month": 25,
            "products": 50,
            "inventory_items": 50,
            "users": 1,
            "ai_messages_per_day": 0,
        },
        "feature_list": [
            "Up to 25 invoices / month",
            "Up to 50 products",
            "GST tax invoices & quotations",
            "Inventory & payment tracking",
            "Basic dashboard analytics",
        ],
    },
    {
        "slug": "pro",
        "name": "Vyastha Pro",
        "description": "The complete Vyastha experience - everything, including Ask Vyastha AI.",
        "monthly_price": 49,
        "yearly_price": 499,
        "currency": "INR",
        "active": True,
        "highlight": True,
        "trial_days": DEFAULT_TRIAL_DAYS,
        "features": {feature: True for feature in FEATURE_KEYS},
        "limits": {
            "invoices_per_month": -1,
            "products": -1,
            "inventory_items": -1,
            "users": -1,
            "ai_messages_per_day": 200,
        },
        "feature_list": [
            "Unlimited GST invoices & quotations",
            "Unlimited products & inventory",
            "Ask Vyastha AI Business Assistant",
            "Voice assistant (Hindi / English / Marathi)",
            "Advanced analytics & reports",
            "WhatsApp & email sharing",
            "Priority support",
        ],
    },
]


PLAN_DEFAULTS_BY_SLUG: dict[str, dict[str, Any]] = {
    plan["slug"]: plan for plan in PLAN_DEFAULTS
}


def get_default_plan(slug: str) -> dict[str, Any]:
    normalized_slug = slug.strip().lower()
    plan = PLAN_DEFAULTS_BY_SLUG.get(normalized_slug)
    if plan is None:
        raise ValueError(f"Unknown subscription plan: {slug}")
    return deepcopy(plan)


def get_plan_rank(slug: str) -> int:
    return PLAN_RANK.get(slug.strip().lower(), PLAN_RANK[FALLBACK_PLAN_SLUG])


def is_upgrade(current_plan: str, new_plan: str) -> bool:
    return get_plan_rank(new_plan) > get_plan_rank(current_plan)


def is_downgrade(current_plan: str, new_plan: str) -> bool:
    return get_plan_rank(new_plan) < get_plan_rank(current_plan)


def rupees_to_paise(amount_in_rupees: int | float) -> int:
    if amount_in_rupees < 0:
        raise ValueError("Amount cannot be negative.")
    return int(round(float(amount_in_rupees) * 100))
