"""
Notifications API
In-app notification CRUD for career alerts, job matches, and reminders.

Notification `type` values in use (plain string column, no DB enum — see
models/database.py's Notification model comment for the original set):
  new_job_match | interview_reminder | application_followup |
  skill_completed | health_score_change | autopilot_approval
Added by this deepening pass (same table, same CRUD pattern — not a parallel
notification system):
  reminder   — a tracked application's follow_up_date is due/overdue.
  milestone  — a CareerMilestone was logged recently.
Both are produced only from real rows already in the DB (Application.
follow_up_date, CareerMilestone) via POST /generate below — never fabricated.
"""
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from core.database import get_db
from core.auth import get_current_user_id
from models.database import Notification, Application, VerifiedJob, CareerMilestone

logger = logging.getLogger(__name__)
router = APIRouter()

# How close a follow-up must be (in days; negative = overdue) to surface a
# "reminder" notification. Kept local since it's a notification-generation
# detail, not shared application logic.
_REMINDER_LOOKAHEAD_DAYS = 3
# Only consider milestones logged within this window "new" for notification
# purposes, so a years-old milestone doesn't suddenly notify.
_MILESTONE_LOOKBACK_DAYS = 7


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


@router.post("/generate")
async def generate_notifications(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Materialize real, data-grounded `reminder` and `milestone` notifications
    for the current user (see module docstring). This codebase has no
    background job runner, so this is an on-demand generator rather than a
    scheduled push — safe to call as often as the bell is opened/polled,
    since it dedupes against notifications it already created (via an
    `extra_data` marker) instead of re-inserting duplicates.

    - reminder: one of the user's own Applications has a follow_up_date
      that is today, overdue, or due within _REMINDER_LOOKAHEAD_DAYS.
    - milestone: one of the user's own CareerMilestones was logged within
      the last _MILESTONE_LOOKBACK_DAYS.
    Nothing here is invented — both sources are real rows already written by
    the applications/career-graph flows.
    """
    created: List[Notification] = []
    try:
        now = datetime.now(timezone.utc)

        # ── reminder: due/overdue follow-ups ──────────────────────────────
        apps_r = await db.execute(
            select(Application, VerifiedJob)
            .outerjoin(VerifiedJob, Application.job_id == VerifiedJob.id)
            .where(Application.user_id == user_id, Application.follow_up_date.isnot(None))
        )
        app_rows = apps_r.all()

        existing_reminders_r = await db.execute(
            select(Notification.extra_data)
            .where(Notification.user_id == user_id, Notification.type == "reminder")
        )
        notified_app_ids = {
            (row[0] or {}).get("application_id")
            for row in existing_reminders_r.all()
            if (row[0] or {}).get("application_id")
        }

        for app, job in app_rows:
            if str(app.id) in notified_app_ids:
                continue
            due = app.follow_up_date
            due_utc = due if due.tzinfo else due.replace(tzinfo=timezone.utc)
            days_until = (due_utc.date() - now.date()).days
            if days_until > _REMINDER_LOOKAHEAD_DAYS:
                continue
            org = job.organization if job else None
            role = job.title if job else app.status
            when = "overdue" if days_until < 0 else "today" if days_until == 0 else f"in {days_until}d"
            notif = Notification(
                user_id=user_id,
                type="reminder",
                title=f"Follow up{f' with {org}' if org else ''}",
                body=f"{role} — follow-up is {when} ({due_utc.date().isoformat()}).",
                action_url="/applications",
                extra_data={"application_id": str(app.id)},
                read=False,
            )
            db.add(notif)
            created.append(notif)

        # ── milestone: recently logged, not yet notified ──────────────────
        milestones_r = await db.execute(
            select(CareerMilestone).where(
                CareerMilestone.user_id == user_id,
                CareerMilestone.created_at >= now - timedelta(days=_MILESTONE_LOOKBACK_DAYS),
            )
        )
        milestones = milestones_r.scalars().all()

        existing_milestones_r = await db.execute(
            select(Notification.extra_data)
            .where(Notification.user_id == user_id, Notification.type == "milestone")
        )
        notified_milestone_ids = {
            (row[0] or {}).get("milestone_id")
            for row in existing_milestones_r.all()
            if (row[0] or {}).get("milestone_id")
        }

        for m in milestones:
            if str(m.id) in notified_milestone_ids:
                continue
            notif = Notification(
                user_id=user_id,
                type="milestone",
                title=f"Milestone logged: {m.title}",
                body="Nice work — consider reflecting this in your resume and portfolio.",
                action_url="/career-graph",
                extra_data={"milestone_id": str(m.id)},
                read=False,
            )
            db.add(notif)
            created.append(notif)

        if created:
            await db.flush()

        return {"created": len(created), "notifications": [_notif_to_dict(n) for n in created]}
    except Exception as exc:
        logger.warning(f"DB unavailable or error for POST /notifications/generate: {exc}")
        return {"created": 0, "notifications": []}


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
