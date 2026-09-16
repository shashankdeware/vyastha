"""
Public plan catalogue routes.

Plan prices and limits are loaded from MongoDB so platform admins
can update plan configuration without redeploying the backend.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from lib.db import db
from models.billing import Plan

router = APIRouter(
    prefix="/plans",
    tags=["plans"],
)


def _clean_mongo_doc(doc: dict[str, Any]) -> dict[str, Any]:
    """Remove MongoDB internal fields before Pydantic validation."""
    cleaned = dict(doc)
    cleaned.pop("_id", None)
    return cleaned


@router.get("", response_model=list[Plan])
async def list_plans() -> list[Plan]:
    """
    Return all active subscription plans ordered by rank.
    """

    documents = (
        await db.plans
        .find({"active": True})
        .sort("rank", 1)
        .to_list(50)
    )

    return [
        Plan(**_clean_mongo_doc(document))
        for document in documents
    ]