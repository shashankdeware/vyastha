"""
Idempotent development seed for Vyastha.

Creates:
- Subscription plans
- Demo business owner
- Platform admin

Run:
    cd /app/backend
    python seed.py

IMPORTANT:
This script is intended for development/staging.
Demo credentials should be supplied through environment variables.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from lib.db import db, ensure_indexes
from lib.plans import PLAN_DEFAULTS, PLAN_RANK
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


DEMO_OWNER = {
    "email": _env("SEED_OWNER_EMAIL", "owner@vyastha.test").lower(),
    "password": _env("SEED_OWNER_PASSWORD"),
    "name": _env("SEED_OWNER_NAME", "Aarav Mehta"),
}

DEMO_ADMIN = {
    "email": _env("SEED_ADMIN_EMAIL", "admin@vyastha.test").lower(),
    "password": _env("SEED_ADMIN_PASSWORD"),
    "name": _env("SEED_ADMIN_NAME", "Vyastha Admin"),
}


async def seed_plans() -> None:
    """Insert missing plans and refresh non-user-editable defaults."""

    now = _now()

    for spec in PLAN_DEFAULTS:
        slug = spec["slug"]
        existing = await db.plans.find_one({"slug": slug})

        doc: dict[str, Any] = dict(spec)
        doc["rank"] = PLAN_RANK[slug]
        doc["updated_at"] = now

        if existing:
            # Preserve values that platform admins may have changed.
            doc.pop("monthly_price", None)
            doc.pop("yearly_price", None)
            doc.pop("active", None)
            doc.pop("razorpay_plan_ids", None)

            await db.plans.update_one(
                {"slug": slug},
                {"$set": doc},
            )
        else:
            doc["id"] = str(uuid.uuid4())
            doc["created_at"] = now

            await db.plans.insert_one(doc)

    count = await db.plans.count_documents({})
    print(f"plans: {count}")


async def seed_user(
    spec: dict[str, str],
    business_name: str,
    is_admin: bool,
) -> None:
    """Create a demo user and its business if the user does not exist."""

    email = spec["email"].strip().lower()
    password = spec["password"].strip()
    name = spec["name"].strip()

    if not password:
        print(
            f"skipped user: {email} "
            "(password not configured; set the appropriate SEED_*_PASSWORD)"
        )
        return

    existing = await db.users.find_one({"email": email})

    if existing:
        print(f"user exists: {email}")
        return

    now = _now()
    business_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    await db.businesses.insert_one(
        {
            "id": business_id,
            "name": business_name,
            "created_at": now,
            "updated_at": now,
        }
    )

    try:
        await db.users.insert_one(
            {
                "id": user_id,
                "email": email,
                "name": name,
                "password_hash": hash_password(password),
                "business_id": business_id,
                "role": "owner",
                "is_platform_admin": is_admin,
                "created_at": now,
                "updated_at": now,
            }
        )
    except Exception:
        # Avoid leaving an orphan business if user creation fails.
        await db.businesses.delete_one({"id": business_id})
        raise

    role = "platform admin" if is_admin else "demo owner"
    print(f"created {role}: {email}")


async def main() -> None:
    await ensure_indexes()

    await seed_plans()

    await seed_user(
        DEMO_OWNER,
        "Mehta Traders",
        is_admin=False,
    )

    await seed_user(
        DEMO_ADMIN,
        "Vyastha HQ",
        is_admin=True,
    )

    print("seed complete")


if __name__ == "__main__":
    asyncio.run(main())