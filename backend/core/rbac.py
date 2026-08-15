"""Explicit role-based access control for operational admin endpoints."""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user
from core.config import settings
from core.database import get_db


def configured_admin_emails() -> set[str]:
    raw = getattr(settings, "ADMIN_EMAILS", "")
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


def is_configured_admin(email: str | None) -> bool:
    return bool(email and email.strip().lower() in configured_admin_emails())


async def get_current_admin(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    role = "user"
    try:
        result = await db.execute(
            text("SELECT role FROM users WHERE id = :id"),
            {"id": str(current_user["user_id"])},
        )
        row = result.mappings().first()
        if row:
            role = str(row.get("role") or "user").lower()
    except SQLAlchemyError:
        await db.rollback()

    if role != "admin" and not is_configured_admin(current_user.get("email")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator role required",
        )
    return {**current_user, "role": "admin"}
