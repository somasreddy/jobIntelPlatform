"""
Digest API
POST /api/digest/send-mine  — send digest to the authenticated user immediately
POST /api/digest/send-all   — admin: send to all users (requires ADMIN_SECRET header)

Note: The users table is managed via raw SQL in auth.py (no ORM model).
We use sqlalchemy text() queries here to stay consistent.
"""
import uuid
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from core.database import get_db
from core.auth import get_current_user_id
from services.digest import send_morning_digest

logger = logging.getLogger(__name__)
router = APIRouter()


async def _get_user(db: AsyncSession, user_id: uuid.UUID) -> dict | None:
    row = await db.execute(
        text("SELECT id, name, email FROM users WHERE id = :id"),
        {"id": str(user_id)},
    )
    r = row.mappings().first()
    return dict(r) if r else None


async def _get_all_users(db: AsyncSession) -> list[dict]:
    rows = await db.execute(text("SELECT id, name, email FROM users"))
    return [dict(r) for r in rows.mappings().all()]


@router.post("/send-mine")
async def send_my_digest(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Send the morning digest to the currently authenticated user."""
    user = await _get_user(db, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    sent = await send_morning_digest(
        user_id=user_id,
        user_email=user["email"],
        user_name=user.get("name") or user["email"].split("@")[0],
        db=db,
    )
    if not sent:
        raise HTTPException(503, "Failed to send digest — check email provider configuration")
    return {"sent": True, "email": user["email"]}


@router.post("/send-all")
async def send_all_digests(
    x_admin_secret: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint: send morning digest to all users.
    Requires X-Admin-Secret header matching ADMIN_SECRET env var.
    Intended to be called by a cron job at ~7 AM daily.
    """
    admin_secret = os.getenv("ADMIN_SECRET", "")
    if not admin_secret or x_admin_secret != admin_secret:
        raise HTTPException(403, "Forbidden")

    users = await _get_all_users(db)
    results = {"sent": 0, "failed": 0, "total": len(users)}

    for user in users:
        try:
            ok = await send_morning_digest(
                user_id=uuid.UUID(str(user["id"])),
                user_email=user["email"],
                user_name=user.get("name") or user["email"].split("@")[0],
                db=db,
            )
            if ok:
                results["sent"] += 1
            else:
                results["failed"] += 1
        except Exception as exc:
            logger.error(f"Digest failed for {user.get('email')}: {exc}")
            results["failed"] += 1

    return results
