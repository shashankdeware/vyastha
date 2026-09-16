"""
FeatureAccessService — the single source of truth for:
"What can this business do right now?"

All subscription feature checks should go through this module.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from server import get_current_user

from fastapi import Depends, HTTPException

from lib.db import db
from lib.plans import FALLBACK_PLAN_SLUG
# from lib.security import current_user


# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------

GRACE_PERIOD_DAYS = 3

# These statuses continue to provide access to the subscribed plan.
#
# "cancelled" means the subscription is cancelled at the end of the
# current billing period, so access should continue until period_end.
ENTITLED_STATUSES = {
    "active",
    "trialing",
    "cancelled",
}


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _aware(
    dt: datetime | None,
) -> datetime | None:
    """
    Ensure a datetime is timezone-aware.

    MongoDB data may sometimes contain a naive datetime depending on the
    database configuration.
    """
    if dt is None:
        return None

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


# ---------------------------------------------------------------------------
# PLAN
# ---------------------------------------------------------------------------

async def get_plan(
    slug: str,
) -> dict[str, Any]:
    """
    Get a plan from MongoDB.

    If the requested plan does not exist, fall back to Free.
    """
    normalized_slug = slug.strip().lower()

    plan = await db.plans.find_one(
        {"slug": normalized_slug}
    )

    if not plan:
        plan = await db.plans.find_one(
            {"slug": FALLBACK_PLAN_SLUG}
        )

    if not plan:
        raise HTTPException(
            status_code=500,
            detail="Plan configuration missing",
        )

    # Never expose MongoDB's internal ObjectId.
    result = dict(plan)
    result.pop("_id", None)

    return result


# ---------------------------------------------------------------------------
# SUBSCRIPTION
# ---------------------------------------------------------------------------

async def get_business_subscription(
    user_id: str,
) -> dict[str, Any] | None:
    """
    Return the newest active subscription record for a business.

    The newest record is determined by created_at.
    Superseded subscriptions are ignored.
    """
    doc = await db.subscriptions.find_one(
        {
            "user_id": user_id,
            "status": {
                "$ne": "superseded"
            },
        },
        sort=[
            ("created_at", -1)
        ],
    )

    if not doc:
        return None

    result = dict(doc)
    result.pop("_id", None)

    return result


# ---------------------------------------------------------------------------
# ENTITLEMENTS
# ---------------------------------------------------------------------------

async def resolve_entitlements(
    user_id: str,
) -> dict[str, Any]:
    """
    Resolve the effective subscription plan for a business.

    The decision is made using:
    - subscription status
    - current billing period
    - grace period
    - fallback Free plan

    Expired subscriptions are persisted as expired.
    """

    subscription = await get_business_subscription(
        user_id
    )

    now = datetime.now(timezone.utc)

    # Default state: Free plan.
    effective_slug = FALLBACK_PLAN_SLUG
    effective_status = "active"
    in_grace_period = False

    # -----------------------------------------------------------------------
    # NO SUBSCRIPTION
    # -----------------------------------------------------------------------

    if subscription is None:
        plan = await get_plan(
            FALLBACK_PLAN_SLUG
        )

        return {
            "plan_slug": plan["slug"],
            "plan_name": plan["name"],
            "status": "active",
            "features": plan.get("features", {}),
            "limits": plan.get("limits", {}),
            "in_grace_period": False,
        }

    # -----------------------------------------------------------------------
    # EXISTING SUBSCRIPTION
    # -----------------------------------------------------------------------

    subscription_status = subscription.get(
        "status",
        "expired",
    )

    effective_status = subscription_status

    period_end = _aware(
        subscription.get("current_period_end")
    )

    plan_slug = str(
        subscription.get(
            "plan_slug",
            FALLBACK_PLAN_SLUG,
        )
    ).strip().lower()

    # -----------------------------------------------------------------------
    # ACTIVE / TRIAL / CANCELLED-AT-PERIOD-END
    # -----------------------------------------------------------------------

    if subscription_status in ENTITLED_STATUSES:

        # If there is no period_end, keep the subscription active.
        #
        # A missing period_end should ideally be prevented when creating
        # subscriptions, but this avoids accidentally removing access.
        if period_end is None:
            effective_slug = plan_slug

        elif now <= period_end:
            effective_slug = plan_slug

        else:
            # Billing period has ended.
            effective_status = "expired"
            effective_slug = FALLBACK_PLAN_SLUG

            subscription_id = subscription.get("id")

            if subscription_id:
                await db.subscriptions.update_one(
                    {"id": subscription_id},
                    {
                        "$set": {
                            "status": "expired",
                            "updated_at": now,
                        }
                    },
                )

    # -----------------------------------------------------------------------
    # PAST DUE
    # -----------------------------------------------------------------------

    elif subscription_status == "past_due":

        if (
            period_end is not None
            and now <= period_end + timedelta(
                days=GRACE_PERIOD_DAYS
            )
        ):
            # Keep paid features temporarily available.
            effective_slug = plan_slug
            in_grace_period = True

        else:
            # Grace period has expired.
            effective_status = "expired"
            effective_slug = FALLBACK_PLAN_SLUG

            subscription_id = subscription.get("id")

            if subscription_id:
                await db.subscriptions.update_one(
                    {"id": subscription_id},
                    {
                        "$set": {
                            "status": "expired",
                            "updated_at": now,
                        }
                    },
                )

    # -----------------------------------------------------------------------
    # PENDING / PAUSED / EXPIRED
    # -----------------------------------------------------------------------

    else:
        effective_slug = FALLBACK_PLAN_SLUG

    # -----------------------------------------------------------------------
    # LOAD EFFECTIVE PLAN
    # -----------------------------------------------------------------------

    plan = await get_plan(
        effective_slug
    )

    return {
        "plan_slug": plan["slug"],
        "plan_name": plan["name"],
        "status": effective_status,
        "features": plan.get("features", {}),
        "limits": plan.get("limits", {}),
        "in_grace_period": in_grace_period,
    }


# ---------------------------------------------------------------------------
# FEATURE ACCESS
# ---------------------------------------------------------------------------

async def has_feature(
    user_id: str,
    feature: str,
) -> bool:
    """
    Return True when the business has access to the requested feature.
    """
    normalized_feature = feature.strip().lower()

    entitlements = await resolve_entitlements(
        user_id
    )

    return bool(
        entitlements["features"].get(
            normalized_feature,
            False,
        )
    )


# ---------------------------------------------------------------------------
# FASTAPI FEATURE GUARD
# ---------------------------------------------------------------------------

def require_feature(
    feature: str,
):
    """
    FastAPI dependency that protects a route behind a subscription feature.

    Example:

        @router.get("/advanced-analytics")
        async def advanced_analytics(
            user: dict = Depends(
                require_feature("advanced_analytics")
            )
        ):
            ...
    """

    normalized_feature = feature.strip().lower()

    async def _guard(
        user: dict[str, Any] = Depends(get_current_user),
    ) -> dict[str, Any]:

        user_id = user.get("id")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Business context is missing.",
            )

        allowed = await has_feature(
            user_id,
            normalized_feature,
        )

        if not allowed:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "upgrade_required",
                    "feature": normalized_feature,
                    "message": (
                        "Your current plan does not include "
                        "this feature."
                    ),
                },
            )

        return user

    return _guard


# ---------------------------------------------------------------------------
# LIMIT CHECKING
# ---------------------------------------------------------------------------

async def get_limit(
    user_id: str,
    limit_key: str,
) -> int:
    """
    Return the current subscription limit.

    -1 means unlimited.
    """
    entitlements = await resolve_entitlements(
        user_id
    )

    return int(
        entitlements["limits"].get(
            limit_key,
            0,
        )
    )


async def check_limit(
    user_id: str,
    limit_key: str,
    current_usage: int,
) -> bool:
    """
    Check whether a business can consume one more unit.

    Example:
        Free plan has 25 invoices/month.
        current_usage = 25
        -> False

    Unlimited (-1) always returns True.
    """
    if current_usage < 0:
        return False

    limit = await get_limit(
        user_id,
        limit_key,
    )

    if limit == -1:
        return True

    return current_usage < limit


def require_limit(
    limit_key: str,
):
    """
    FastAPI dependency factory for routes that need a subscription limit.

    This dependency verifies that the configured limit is greater than zero.
    Actual usage should still be checked inside the business operation.
    """

    async def _guard(
        user: dict[str, Any] =Depends(get_current_user) ,
    ) -> dict[str, Any]:

        user_id = user.get("id")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Business context is missing.",
            )

        limit = await get_limit(
            user_id,
            limit_key,
        )

        if limit == 0:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "upgrade_required",
                    "limit": limit_key,
                    "message": (
                        "Your current plan does not include "
                        "this limit."
                    ),
                },
            )

        return user

    return _guard