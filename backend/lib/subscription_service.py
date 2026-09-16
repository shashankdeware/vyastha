"""
Subscription + Stripe service for Vyastha.

- Plans (pricing) live in MongoDB and are admin-configurable.
- The free trial (default 90 days) is granted on signup on the Pro feature set.
- Paid upgrades go through Stripe Checkout (emergentintegrations), amounts are
  always computed server-side in INR - the frontend never sends a price.
- We manage the subscription period ourselves (current_period_end) so plan
  entitlements are resolved by lib.features.
"""

from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from lib.db import db
from lib import plans as plans_lib

logger = logging.getLogger(__name__)

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def is_stripe_configured() -> bool:
    return bool(STRIPE_API_KEY)


async def seed_plans() -> None:
    """Insert missing plans; refresh non-admin-editable fields, preserve prices/active/trial."""
    now = _now()
    for spec in plans_lib.PLAN_DEFAULTS:
        slug = spec["slug"]
        existing = await db.plans.find_one({"slug": slug})
        doc: dict[str, Any] = dict(spec)
        doc["rank"] = plans_lib.PLAN_RANK[slug]
        doc["updated_at"] = now.isoformat()
        if existing:
            # Preserve values a platform admin may have changed.
            for key in ("monthly_price", "yearly_price", "active", "trial_days", "features", "limits", "highlight"):
                doc.pop(key, None)
            await db.plans.update_one({"slug": slug}, {"$set": doc})
        else:
            doc["id"] = str(uuid.uuid4())
            doc["created_at"] = now.isoformat()
            await db.plans.insert_one(doc)


async def get_plan_doc(slug: str) -> dict[str, Any] | None:
    doc = await db.plans.find_one({"slug": slug.strip().lower()}, {"_id": 0})
    return doc


async def ensure_trial(user_id: str) -> dict[str, Any] | None:
    """Grant a Pro free-trial subscription to a brand-new user (idempotent)."""
    existing = await db.subscriptions.find_one({"user_id": user_id})
    if existing:
        return None
    pro = await get_plan_doc("pro")
    if not pro:
        return None
    trial_days = int(pro.get("trial_days", plans_lib.DEFAULT_TRIAL_DAYS) or plans_lib.DEFAULT_TRIAL_DAYS)
    now = _now()
    sub = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "plan_id": pro.get("id", ""),
        "plan_slug": "pro",
        "billing_cycle": "trial",
        "status": "trialing",
        "amount": 0,
        "currency": "INR",
        "trial_start": now.isoformat(),
        "trial_end": (now + timedelta(days=trial_days)).isoformat(),
        "current_period_start": now,
        "current_period_end": now + timedelta(days=trial_days),
        "cancel_at_period_end": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.subscriptions.insert_one(sub)
    return sub


async def activate_paid_subscription(user_id: str, plan_slug: str, billing_cycle: str, amount: float,
                                     session_id: str | None = None) -> dict[str, Any]:
    """Called after a verified Stripe payment. Supersedes any prior subscription."""
    now = _now()
    days = 365 if billing_cycle == "yearly" else 30
    plan = await get_plan_doc(plan_slug)
    await db.subscriptions.update_many(
        {"user_id": user_id, "status": {"$nin": ["superseded", "expired"]}},
        {"$set": {"status": "superseded", "updated_at": now}},
    )
    sub = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "plan_id": (plan or {}).get("id", ""),
        "plan_slug": plan_slug,
        "billing_cycle": billing_cycle,
        "status": "active",
        "amount": amount,
        "currency": "INR",
        "current_period_start": now,
        "current_period_end": now + timedelta(days=days),
        "cancel_at_period_end": False,
        "stripe_session_id": session_id,
        "created_at": now,
        "updated_at": now,
    }
    await db.subscriptions.insert_one(sub)
    return sub


async def cancel_subscription(user_id: str) -> bool:
    """Cancel at period end - keeps access until current_period_end."""
    res = await db.subscriptions.update_one(
        {"user_id": user_id, "status": {"$in": ["active", "trialing"]}},
        {"$set": {"status": "cancelled", "cancel_at_period_end": True, "cancelled_at": _now(), "updated_at": _now()}},
    )
    return res.modified_count > 0


def plan_price_rupees(plan: dict[str, Any], billing_cycle: str) -> float:
    if billing_cycle == "yearly":
        return float(plan.get("yearly_price", 0))
    return float(plan.get("monthly_price", 0))
