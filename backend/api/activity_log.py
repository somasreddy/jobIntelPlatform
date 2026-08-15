"""
Pipeline Activity Log API
Real, timestamped events for the Pipeline/CRM module (frontend/app/
applications/page.tsx): application status changes, follow-up set/cleared/
completed, contact status changes, and outreach notes — plus a lightweight
follow-up-reminder check that turns due/overdue follow-ups into real
Notification rows (reusing the existing Notification model from
backend/api/notifications.py — this does NOT introduce a parallel
notification system).

Honesty note on `contact_id`: Outreach CRM contacts are a client-side-only
concept today (kept in the browser's localStorage by the Pipeline page —
there is no `contacts` table in this schema, and contact ids generated
there are short random strings, not UUIDs). This API validates `contact_id`
as a real UUID when present, same as `application_id` — the frontend simply
does not call this endpoint for contact-scoped events yet, and logs those
locally instead, rather than this module fabricating a relationship to a
table that doesn't exist. See models/database.py's ActivityLog docstring
for the full rationale.

Follow-up reminders: this platform's Celery workers (workers/job_scheduler,
workers/verification_scheduler) run recurring background tasks, but adding
a new one was out of scope for this change (workers/ was not part of the
assigned file set). Instead, `POST /check-followup-reminders` is a
lightweight, idempotent check meant to be called at page-load time from the
Pipeline page — it is not a true background job, so a reminder only
actually fires the next time a user with a due follow-up opens that page.
That limitation is deliberate and disclosed here rather than silently
simulated as "live".
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.auth import get_current_user_id
from models.database import ActivityLog, Application, Notification

logger = logging.getLogger(__name__)
router = APIRouter()

# Kept in sync with the ActivityLog.action_type comment in models/database.py.
ALLOWED_ACTION_TYPES = {
    "status_change",
    "follow_up_set",
    "follow_up_cleared",
    "follow_up_completed",
    "note_added",
    "contact_status_change",
    "outreach_logged",
    "reminder_sent",
}


# ─── Schemas ─────────────────────────────────────────────────────────────────

class ActivityLogCreate(BaseModel):
    application_id: Optional[str] = None
    contact_id: Optional[str] = None
    action_type: str
    note: Optional[str] = None
    metadata: Optional[dict] = None


# ─── Serializer ──────────────────────────────────────────────────────────────

def _entry_to_dict(e: ActivityLog) -> dict:
    return {
        "id": str(e.id),
        "applicationId": str(e.application_id) if e.application_id else None,
        "contactId": str(e.contact_id) if e.contact_id else None,
        "actionType": e.action_type,
        "note": e.note,
        "metadata": e.extra_data or {},
        "createdAt": e.created_at.isoformat() if e.created_at else None,
    }


def _parse_uuid(value: Optional[str], field: str) -> Optional[uuid.UUID]:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {field}")


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("")
async def list_activity(
    application_id: Optional[str] = Query(None),
    contact_id: Optional[str] = Query(None),
    limit: int = Query(200, le=500),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List activity log entries for the current user, newest first.

    Degrades to an empty list (rather than a 500) when the database is
    unreachable, matching the resilience pattern already used by
    api/notifications.py — the Pipeline page treats this as "no history
    yet", not an error.
    """
    try:
        app_uuid = _parse_uuid(application_id, "application_id")
        contact_uuid = _parse_uuid(contact_id, "contact_id")

        query = select(ActivityLog).where(ActivityLog.user_id == user_id)
        if app_uuid is not None:
            query = query.where(ActivityLog.application_id == app_uuid)
        if contact_uuid is not None:
            query = query.where(ActivityLog.contact_id == contact_uuid)
        query = query.order_by(ActivityLog.created_at.desc()).limit(limit)

        result = await db.execute(query)
        entries = result.scalars().all()
        return {"entries": [_entry_to_dict(e) for e in entries]}
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"DB unavailable for GET /activity-log, returning empty: {exc}")
        return {"entries": []}


@router.post("", status_code=201)
async def create_activity(
    payload: ActivityLogCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Log one real event against an application and/or contact.

    Exactly one of application_id/contact_id is expected in practice (see
    module docstring), but both are accepted so a future event that spans
    both (e.g. "logged outreach tied to this application and this contact")
    doesn't need a schema change.
    """
    if payload.action_type not in ALLOWED_ACTION_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"action_type must be one of: {sorted(ALLOWED_ACTION_TYPES)}",
        )
    app_uuid = _parse_uuid(payload.application_id, "application_id")
    contact_uuid = _parse_uuid(payload.contact_id, "contact_id")
    if app_uuid is None and contact_uuid is None:
        raise HTTPException(status_code=400, detail="application_id or contact_id is required")

    try:
        entry = ActivityLog(
            user_id=user_id,
            application_id=app_uuid,
            contact_id=contact_uuid,
            action_type=payload.action_type,
            note=payload.note,
            extra_data=payload.metadata or {},
        )
        db.add(entry)
        await db.flush()
        return _entry_to_dict(entry)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"DB unavailable for POST /activity-log: {exc}")
        return {"error": "unavailable"}


@router.post("/check-followup-reminders")
async def check_followup_reminders(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Lightweight, idempotent check: turn due/overdue application follow-ups
    into real Notification rows (see module docstring re: this being a
    page-load-time check rather than a true background job).

    Idempotent via a dedupe check against extra_data.application_id +
    extra_data.follow_up_date on existing "application_followup"
    notifications for this user — calling this repeatedly (e.g. every time
    the Pipeline page loads) will not create duplicate reminders for the
    same application/date pair.
    """
    try:
        now = datetime.now(timezone.utc)

        apps_result = await db.execute(
            select(Application).where(
                Application.user_id == user_id,
                Application.follow_up_date.isnot(None),
                Application.follow_up_date <= now,
            )
        )
        due_apps: List[Application] = list(apps_result.scalars().all())
        if not due_apps:
            return {"checked": 0, "created": 0}

        job_ids = [a.job_id for a in due_apps if a.job_id]
        jobs_by_id = {}
        if job_ids:
            from models.database import VerifiedJob
            jobs_result = await db.execute(select(VerifiedJob).where(VerifiedJob.id.in_(job_ids)))
            jobs_by_id = {j.id: j for j in jobs_result.scalars().all()}

        existing_result = await db.execute(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.type == "application_followup",
            )
        )
        already_notified = set()
        for n in existing_result.scalars().all():
            meta = n.extra_data or {}
            key = (meta.get("application_id"), meta.get("follow_up_date"))
            if key[0]:
                already_notified.add(key)

        created = 0
        for app in due_apps:
            follow_up_str = str(app.follow_up_date)[:10] if app.follow_up_date else None
            key = (str(app.id), follow_up_str)
            if key in already_notified:
                continue

            job = jobs_by_id.get(app.job_id)
            job_title = job.title if job else "this role"
            org = job.organization if job else ""
            is_overdue = app.follow_up_date < now
            title = "Follow-up overdue" if is_overdue else "Follow-up due today"
            body = f"{job_title}{f' at {org}' if org else ''} — follow up you scheduled is {'overdue' if is_overdue else 'due today'}."

            notif = Notification(
                user_id=user_id,
                type="application_followup",
                title=title,
                body=body,
                action_url="/applications",
                extra_data={"application_id": str(app.id), "follow_up_date": follow_up_str},
                read=False,
            )
            db.add(notif)

            db.add(ActivityLog(
                user_id=user_id,
                application_id=app.id,
                action_type="reminder_sent",
                note=title,
                extra_data={"follow_up_date": follow_up_str},
            ))
            created += 1

        await db.flush()
        return {"checked": len(due_apps), "created": created}
    except Exception as exc:
        logger.warning(f"DB unavailable for POST /activity-log/check-followup-reminders: {exc}")
        return {"checked": 0, "created": 0}
