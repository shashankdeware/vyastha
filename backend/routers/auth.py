"""
Authentication routes for Vyastha.

Authentication method:
- Email + password
- Server-side session
- httpOnly cookie
- Every user belongs to one business

Security:
- Passwords are never stored in plain text.
- Session identifiers are stored server-side.
- Authentication cookies are httpOnly.
- Password errors use a generic message.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.db import db
from lib.features import resolve_entitlements
from lib.security import (
    create_session,
    current_user,
    destroy_session,
    hash_password,
    verify_password,
)
from models.billing import (
    BusinessOut,
    EntitlementsOut,
    LoginRequest,
    SignupRequest,
    UserOut,
)


router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


# ---------------------------------------------------------------------------
# USER RESPONSE
# ---------------------------------------------------------------------------

async def _user_out(
    user: dict[str, Any],
) -> UserOut:
    """
    Convert an internal MongoDB user document into a safe public response.

    Password hashes and other internal fields are never returned.
    """

    business_id = user.get("business_id")

    if not business_id:
        raise HTTPException(
            status_code=500,
            detail="User business configuration is missing.",
        )

    business = await db.businesses.find_one(
        {"id": business_id}
    )

    if business is None:
        raise HTTPException(
            status_code=500,
            detail="Business configuration is missing.",
        )

    return UserOut(
        id=str(user["id"]),
        email=str(user["email"]),
        name=str(user.get("name", "")),
        role=str(user.get("role", "owner")),
        is_platform_admin=bool(
            user.get("is_platform_admin", False)
        ),
        business=BusinessOut(
            id=str(business["id"]),
            name=str(
                business.get(
                    "name",
                    "Business",
                )
            ),
        ),
    )


# ---------------------------------------------------------------------------
# SIGNUP
# ---------------------------------------------------------------------------

@router.post(
    "/signup",
    response_model=UserOut,
)
async def signup(
    payload: SignupRequest,
    response: Response,
) -> UserOut:
    """
    Create a new Vyastha user and business.

    A newly registered user becomes the owner of the created business.
    """

    email = str(payload.email).strip().lower()
    name = payload.name.strip()
    business_name = payload.business_name.strip()

    if not name or not business_name:
        raise HTTPException(
            status_code=400,
            detail="Name and business name are required.",
        )

    # Prevent duplicate accounts.
    existing_user = await db.users.find_one(
        {"email": email}
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail=(
                "An account with this email "
                "already exists."
            ),
        )

    now = datetime.now(timezone.utc)

    business_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    # -----------------------------------------------------------------------
    # CREATE BUSINESS
    # -----------------------------------------------------------------------

    business = {
        "id": business_id,
        "name": business_name,
        "created_at": now,
        "updated_at": now,
    }

    await db.businesses.insert_one(
        business
    )

    # -----------------------------------------------------------------------
    # CREATE USER
    # -----------------------------------------------------------------------

    user = {
        "id": user_id,
        "email": email,
        "name": name,
        "password_hash": hash_password(
            payload.password
        ),
        "business_id": business_id,
        "role": "owner",
        "is_platform_admin": False,
        "created_at": now,
        "updated_at": now,
    }

    try:
        await db.users.insert_one(
            user
        )

    except Exception:
        # If user creation fails, remove the business that was created
        # immediately before it. This prevents orphan businesses.
        await db.businesses.delete_one(
            {"id": business_id}
        )
        raise

    # -----------------------------------------------------------------------
    # CREATE SESSION
    # -----------------------------------------------------------------------

    await create_session(
        response,
        user_id,
    )

    return await _user_out(
        user
    )


# ---------------------------------------------------------------------------
# LOGIN
# ---------------------------------------------------------------------------

@router.post(
    "/login",
    response_model=UserOut,
)
async def login(
    payload: LoginRequest,
    response: Response,
) -> UserOut:
    """
    Authenticate a user using email + password.
    """

    email = str(
        payload.email
    ).strip().lower()

    user = await db.users.find_one(
        {"email": email}
    )

    password_hash = (
        user.get("password_hash", "")
        if user
        else ""
    )

    # Generic error prevents account enumeration.
    if (
        not user
        or not password_hash
        or not verify_password(
            payload.password,
            password_hash,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not user.get("business_id"):
        raise HTTPException(
            status_code=500,
            detail="User business configuration is missing.",
        )

    await create_session(
        response,
        str(user["id"]),
    )

    return await _user_out(
        user
    )


# ---------------------------------------------------------------------------
# LOGOUT
# ---------------------------------------------------------------------------

@router.post(
    "/logout",
)
async def logout(
    request: Request,
    response: Response,
) -> dict[str, bool]:
    """
    Destroy the current server-side session and clear the cookie.
    """

    await destroy_session(
        request,
        response,
    )

    return {
        "ok": True
    }


# ---------------------------------------------------------------------------
# CURRENT USER
# ---------------------------------------------------------------------------

@router.get(
    "/me",
    response_model=UserOut,
)
async def me(
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> UserOut:
    """
    Return the currently authenticated user.
    """

    return await _user_out(
        user
    )


# ---------------------------------------------------------------------------
# ENTITLEMENTS
# ---------------------------------------------------------------------------

@router.get(
    "/entitlements",
    response_model=EntitlementsOut,
)
async def entitlements(
    user: dict[str, Any] = Depends(
        current_user
    ),
) -> EntitlementsOut:
    """
    Return the effective subscription features and limits
    available to the current business.
    """

    business_id = user.get(
        "business_id"
    )

    if not business_id:
        raise HTTPException(
            status_code=500,
            detail="Business context is missing.",
        )

    entitlement_data = await resolve_entitlements(
        business_id
    )

    return EntitlementsOut(
        **entitlement_data
    )