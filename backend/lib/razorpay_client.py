"""
Razorpay SDK boundary for Vyastha.

Security rules:
- Razorpay secrets are read only from environment variables.
- Razorpay secret keys are never returned to the frontend.
- Payment/order/webhook signatures are verified server-side.
- Gateway exceptions are logged without exposing sensitive details.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
from typing import Any

import razorpay


logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# ENVIRONMENT / CONFIGURATION
# ---------------------------------------------------------------------------

def key_id() -> str:
    """Return the public Razorpay Key ID."""
    return os.environ.get("RAZORPAY_KEY_ID", "").strip()


def _key_secret() -> str:
    """Return the private Razorpay API secret."""
    return os.environ.get("RAZORPAY_KEY_SECRET", "").strip()


def _webhook_secret() -> str:
    """Return the Razorpay webhook secret."""
    return os.environ.get("RAZORPAY_WEBHOOK_SECRET", "").strip()


def is_configured() -> bool:
    """Check whether the Razorpay API credentials are configured."""
    return bool(key_id() and _key_secret())


def get_client() -> razorpay.Client:
    """
    Create and return a configured Razorpay client.

    Raises:
        RuntimeError: If Razorpay credentials are missing.
    """
    if not is_configured():
        raise RuntimeError("Razorpay is not configured")

    client = razorpay.Client(
        auth=(key_id(), _key_secret())
    )

    client.set_app_details(
        {
            "title": "Vyastha",
            "version": "1.0.0",
        }
    )

    return client


# ---------------------------------------------------------------------------
# SIGNATURE VERIFICATION
# ---------------------------------------------------------------------------

def verify_payment_signature(
    payment_id: str,
    subscription_id: str,
    signature: str,
) -> bool:
    """
    Verify Razorpay subscription checkout signature.

    Signature payload:
        payment_id + "|" + subscription_id
    """
    secret = _key_secret()

    if not secret or not signature:
        return False

    payload = f"{payment_id}|{subscription_id}".encode("utf-8")

    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(
        expected,
        signature,
    )


def verify_order_signature(
    order_id: str,
    payment_id: str,
    signature: str,
) -> bool:
    """
    Verify Razorpay order payment signature.

    Signature payload:
        order_id + "|" + payment_id
    """
    secret = _key_secret()

    if not secret or not signature:
        return False

    payload = f"{order_id}|{payment_id}".encode("utf-8")

    expected = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(
        expected,
        signature,
    )


def verify_webhook_signature(
    raw_body: bytes,
    signature: str,
) -> bool:
    """
    Verify Razorpay webhook signature.

    IMPORTANT:
    raw_body must be the exact raw HTTP request body.
    Do not JSON serialize the parsed body again before verification.
    """
    secret = _webhook_secret()

    if not secret or not signature:
        return False

    expected = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(
        expected,
        signature,
    )


# ---------------------------------------------------------------------------
# ERROR HANDLING
# ---------------------------------------------------------------------------

def safe_error(exc: Exception) -> str:
    """
    Log a generic Razorpay error internally.

    Sensitive gateway details are not exposed to the browser.
    """
    logger.error(
        "Razorpay call failed: %s",
        type(exc)._name_,
        exc_info=False,
    )

    return (
        "Payment gateway request failed. "
        "Please try again."
    )


# ---------------------------------------------------------------------------
# CURRENCY
# ---------------------------------------------------------------------------

def to_paise(
    rupees: float | int,
) -> int:
    """
    Convert INR rupees to paise.

    Example:
        499 -> 49900
        1299 -> 129900
    """
    amount = float(rupees)

    if amount < 0:
        raise ValueError("Amount cannot be negative.")

    return int(round(amount * 100))


# ---------------------------------------------------------------------------
# RAZORPAY PLAN CREATION
# ---------------------------------------------------------------------------

def ensure_razorpay_plan(
    client: razorpay.Client,
    plan: dict[str, Any],
    cycle: str,
) -> str:
    """
    Create a Razorpay subscription plan.

    NOTE:
    Razorpay Plan IDs should ideally be stored in MongoDB after creation.
    Do not call this repeatedly without checking whether the local plan
    already has a Razorpay Plan ID.

    Args:
        client: Configured Razorpay client.
        plan: Local Vyastha plan configuration.
        cycle: "monthly" or "yearly".

    Returns:
        Razorpay Plan ID.

    Raises:
        ValueError: If the billing cycle or plan data is invalid.
    """

    normalized_cycle = cycle.strip().lower()

    if normalized_cycle not in {"monthly", "yearly"}:
        raise ValueError(
            "Invalid billing cycle. "
            "Use 'monthly' or 'yearly'."
        )

    if "slug" not in plan:
        raise ValueError("Plan slug is required.")

    if "name" not in plan:
        raise ValueError("Plan name is required.")

    if normalized_cycle == "monthly":
        price = plan.get("monthly_price", 0)
        period = "monthly"

    else:
        price = plan.get("yearly_price", 0)
        period = "yearly"

    amount = to_paise(price)

    currency = str(
        plan.get("currency", "INR")
    ).upper()

    description = str(
        plan.get("description", "")
    ).strip()

    razorpay_plan = client.plan.create(
        {
            "period": period,
            "interval": 1,
            "item": {
                "name": (
                    f"Vyastha {plan['name']} "
                    f"({normalized_cycle})"
                ),
                "amount": amount,
                "currency": currency,
                "description": description,
            },
            "notes": {
                "plan_slug": str(plan["slug"]),
                "billing_cycle": normalized_cycle,
            },
        }
    )

    razorpay_plan_id = razorpay_plan.get("id")

    if not razorpay_plan_id:
        raise RuntimeError(
            "Razorpay did not return a plan ID."
        )

    return str(razorpay_plan_id)