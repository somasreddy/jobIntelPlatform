"""
Notifications API
In-app notification CRUD for career alerts, job matches, and reminders.
"""
import uuid
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from core.database import get_db
from core.auth import get_current_user_id
from models.database import Notification

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class NotificationCreate(BaseModel):
    type: str
    title: str
    body: str
    action_url: Optional[str] = None
    metadata: Optional[dict] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("")
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, le=100),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        query = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        if unread_only:
            query = query.where(Notification.read == False)

        result = await db.execute(query)
        notifications = result.scalars().all()

        unread_count_r = await db.execute(
            select(Notification)
            .where(Notification.user_id == user_id, Notification.read == False)
        )
        unread_count = len(unread_count_r.scalars().all())

        return {
            "notifications": [_notif_to_dict(n) for n in notifications],
            "unread_count": unread_count,
        }
    except Exception as exc:
        logger.warning(f"DB unavailable for GET /notifications, returning empty: {exc}")
        return {"notifications": [], "unread_count": 0}


@router.post("")
async def create_notification(
    payload: NotificationCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        notif = Notification(
            user_id=user_id,
            type=payload.type,
            title=payload.title,
            body=payload.body,
            action_url=payload.action_url,
            extra_data=payload.metadata or {},
            read=False,
        )
        db.add(notif)
        await db.flush()
        return _notif_to_dict(notif)
    except Exception as exc:
        logger.warning(f"DB unavailable for POST /notifications: {exc}")
        return {"error": "unavailable"}


@router.post("/mark-all-read")
@router.post("/mark-read")
async def mark_all_read(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        await db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read == False)
            .values(read=True)
        )
    except Exception as exc:
        logger.warning(f"DB unavailable for mark-all-read: {exc}")
    return {"marked_read": True}


@router.post("/{notification_id}/read")
@router.patch("/{notification_id}/read")
async def mark_one_read(
    notification_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        await db.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(read=True)
        )
    except Exception as exc:
        logger.warning(f"DB unavailable for mark-one-read: {exc}")
    return {"marked_read": str(notification_id)}


# ─── Serialiser ──────────────────────────────────────────────────────────────

def _notif_to_dict(n: Notification) -> dict:
    return {
        "id": str(n.id),
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "action_url": n.action_url,
        "metadata": n.extra_data or {},
        "read": n.read,
        "is_read": n.read,   # frontend alias
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }
