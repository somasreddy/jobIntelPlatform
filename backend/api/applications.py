import uuid
import logging
from typing import Optional
from datetime import datetime, timezone
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from core.database import get_db
from core.auth import get_current_user_id
from models.database import Application, ApplicationEvent, OutboxEvent, VerifiedJob
from services.application_status import (
    display_application_status,
    display_statuses,
    normalize_application_status,
)

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_STATUSES = display_statuses()


class ApplicationCreate(BaseModel):
    job_id: str
    status: str = "Saved"
    notes: Optional[str] = None
    follow_up_date: Optional[str] = None
    evaluation_score: Optional[float] = None
    archetype: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    follow_up_date: Optional[str] = None
    evaluation_score: Optional[float] = None
    archetype: Optional[str] = None


def _app_to_dict(app: Application) -> dict:
    job = getattr(app, "job", None)
    return {
        "id": str(app.id),
        "jobId": str(app.job_id) if app.job_id else None,
        "status": display_application_status(app.status),
        "statusKey": normalize_application_status(app.status, strict=False),
        "dateApplied": str(app.date_applied)[:10] if app.date_applied else None,
        "followUpDate": str(app.follow_up_date)[:10] if app.follow_up_date else None,
        "evaluationScore": app.evaluation_score,
        "archetype": app.archetype,
        "notes": app.notes,
        "evaluationReport": app.evaluation_report,
        "job": {
            "id": str(job.id),
            "title": job.title,
            "organization": job.organization,
            "location": job.location,
            "workMode": job.work_mode,
            "salaryMin": job.salary_min,
            "salaryMax": job.salary_max,
            "currency": job.currency,
            "technologies": job.technologies or [],
            "verificationStatus": job.verification_status,
            "applicationLink": job.application_link,
            "matchScore": job.match_score,
        } if job else None,
    }


# ── GET /  ─────────────────────────────────────────────────────────────────
@router.get("/")
async def get_applications(
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Get all applications for the current user."""
    stmt = (
        select(Application)
        .where(Application.user_id == uid)
        .order_by(Application.created_at.desc())
    )
    result = await db.execute(stmt)
    apps = result.scalars().all()

    # Batch-load all related jobs in ONE query (no N+1)
    job_ids = [a.job_id for a in apps if a.job_id]
    jobs_by_id: dict = {}
    if job_ids:
        jobs_result = await db.execute(
            select(VerifiedJob).where(VerifiedJob.id.in_(job_ids))
        )
        jobs_by_id = {j.id: j for j in jobs_result.scalars().all()}

    for app in apps:
        app.job = jobs_by_id.get(app.job_id)

    return [_app_to_dict(app) for app in apps]


# ── POST /  ────────────────────────────────────────────────────────────────
@router.post("/", status_code=201)
async def create_application(
    payload: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Create a new job application tracking entry."""
    try:
        canonical_status = normalize_application_status(payload.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"status must be one of: {VALID_STATUSES}")
    try:
        job_uid = uuid.UUID(payload.job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id")

    follow_up = None
    if payload.follow_up_date:
        try:
            follow_up = datetime.fromisoformat(payload.follow_up_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid follow_up_date — use ISO format YYYY-MM-DD")

    app = Application(
        user_id=uid,
        job_id=job_uid,
        status=canonical_status,
        notes=payload.notes,
        evaluation_score=payload.evaluation_score,
        archetype=payload.archetype,
        date_applied=datetime.utcnow() if canonical_status == "applied" else None,
        follow_up_date=follow_up,
    )
    db.add(app)
    await db.flush()
    db.add(ApplicationEvent(
        application_id=app.id,
        actor_id=uid,
        event_type="application_created",
        to_status=app.status,
        payload={"job_id": payload.job_id},
    ))
    db.add(OutboxEvent(
        aggregate_type="application",
        aggregate_id=str(app.id),
        event_type="application.created",
        payload={"application_id": str(app.id), "job_id": payload.job_id, "status": app.status},
    ))
    await db.flush()
    await db.refresh(app)
    return {
        "id": str(app.id),
        "status": display_application_status(app.status),
        "statusKey": normalize_application_status(app.status, strict=False),
        "job_id": payload.job_id,
    }


# ── PATCH /{id}  ───────────────────────────────────────────────────────────
@router.patch("/{app_id}")
async def update_application(
    app_id: str,
    payload: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Update status, notes, follow-up date, or evaluation data."""
    try:
        app_uid = uuid.UUID(app_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid app ID")

    result = await db.execute(
        select(Application).where(Application.id == app_uid, Application.user_id == uid)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    previous_status = normalize_application_status(app.status, strict=False)
    canonical_status: str | None = None
    if payload.status is not None:
        try:
            canonical_status = normalize_application_status(payload.status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {VALID_STATUSES}")
        app.status = canonical_status
        if canonical_status == "applied" and not app.date_applied:
            app.date_applied = datetime.utcnow()
    if payload.notes is not None:
        app.notes = payload.notes
    if payload.evaluation_score is not None:
        app.evaluation_score = payload.evaluation_score
    if payload.archetype is not None:
        app.archetype = payload.archetype
    if payload.follow_up_date is not None:
        try:
            app.follow_up_date = datetime.fromisoformat(payload.follow_up_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid follow_up_date — use ISO format YYYY-MM-DD")

    if canonical_status is not None and canonical_status != previous_status:
        db.add(ApplicationEvent(
            application_id=app.id,
            actor_id=uid,
            event_type="status_changed",
            from_status=previous_status,
            to_status=canonical_status,
            payload={},
        ))
        db.add(OutboxEvent(
            aggregate_type="application",
            aggregate_id=str(app.id),
            event_type="application.status_changed",
            payload={"application_id": str(app.id), "from_status": previous_status, "to_status": canonical_status},
        ))

    await db.flush()
    return {
        "id": str(app.id),
        "status": display_application_status(app.status),
        "statusKey": normalize_application_status(app.status, strict=False),
    }


@router.get("/{app_id}/timeline")
async def get_application_timeline(
    app_id: str,
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Return the immutable event history for one user-owned application."""
    try:
        app_uid = uuid.UUID(app_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid app ID")

    result = await db.execute(
        select(Application.id).where(
            Application.id == app_uid, Application.user_id == uid
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Application not found")

    events_result = await db.execute(
        select(ApplicationEvent)
        .where(ApplicationEvent.application_id == app_uid)
        .order_by(ApplicationEvent.occurred_at.desc())
    )
    events = events_result.scalars().all()
    return {
        "application_id": str(app_uid),
        "events": [
            {
                "id": str(event.id),
                "event_type": event.event_type,
                "actor_id": str(event.actor_id),
                "from_status": display_application_status(event.from_status) if event.from_status else None,
                "from_status_key": normalize_application_status(event.from_status, strict=False) if event.from_status else None,
                "to_status": display_application_status(event.to_status) if event.to_status else None,
                "to_status_key": normalize_application_status(event.to_status, strict=False) if event.to_status else None,
                "payload": event.payload or {},
                "occurred_at": event.occurred_at.isoformat() if event.occurred_at else None,
            }
            for event in events
        ],
    }

# ── DELETE /{id}  ──────────────────────────────────────────────────────────
@router.delete("/{app_id}")
async def delete_application(
    app_id: str,
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    try:
        app_uid = uuid.UUID(app_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid app ID")
    result = await db.execute(
        select(Application).where(Application.id == app_uid, Application.user_id == uid)
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    await db.delete(app)
    return {"deleted": str(app_uid)}


# ── GET /analytics  ────────────────────────────────────────────────────────
@router.get("/analytics")
async def get_application_analytics(
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Pipeline analytics: stage breakdown, response rate, offer rate, follow-ups."""
    result = await db.execute(
        select(Application).where(Application.user_id == uid)
    )
    apps = result.scalars().all()

    if not apps:
        return {"message": "No applications yet", "total": 0}

    stage_counter = Counter(display_application_status(a.status) for a in apps)
    all_stages = [
        "Discovered", "Saved", "Shortlisted", "Tailoring", "Ready to Apply",
        "Applied", "Recruiter Contacted", "Screening", "Assessment", "Interview",
        "Final Interview", "Offer", "Rejected", "Archived",
    ]
    stage_breakdown = {s: stage_counter.get(s, 0) for s in all_stages}

    total = len(apps)
    applied_count = sum(stage_counter.get(s, 0) for s in ["Applied", "Recruiter Contacted", "Screening", "Assessment", "Interview", "Final Interview", "Offer", "Rejected"])
    responded_count = sum(stage_counter.get(s, 0) for s in ["Recruiter Contacted", "Screening", "Assessment", "Interview", "Final Interview", "Offer"])
    offer_count = stage_counter.get("Offer", 0)
    response_rate = round(responded_count / applied_count * 100, 1) if applied_count else 0
    offer_rate    = round(offer_count / applied_count * 100, 1) if applied_count else 0

    days_to_apply = []
    for a in apps:
        if a.date_applied and a.created_at:
            delta = (a.date_applied.replace(tzinfo=timezone.utc) - a.created_at.replace(tzinfo=timezone.utc)).days
            if delta >= 0:
                days_to_apply.append(delta)
    avg_days = round(sum(days_to_apply) / len(days_to_apply), 1) if days_to_apply else None

    # Batch-load jobs for company/role stats — single query
    app_job_ids = [a.job_id for a in apps if a.job_id]
    company_counter: Counter = Counter()
    role_counter: Counter    = Counter()
    if app_job_ids:
        jobs_res = await db.execute(
            select(VerifiedJob).where(VerifiedJob.id.in_(app_job_ids))
        )
        for j in jobs_res.scalars().all():
            company_counter[j.organization] += 1
            role_counter[j.title] += 1

    now = datetime.now(timezone.utc)
    upcoming_followups = [
        {"app_id": str(a.id), "follow_up_date": str(a.follow_up_date)[:10]}
        for a in apps
        if a.follow_up_date and 0 <= (a.follow_up_date.replace(tzinfo=timezone.utc) - now).days <= 7
    ]

    return {
        "total": total,
        "stage_breakdown": stage_breakdown,
        "response_rate_pct": response_rate,
        "offer_rate_pct": offer_rate,
        "avg_days_to_apply": avg_days,
        "top_companies": [{"company": c, "count": n} for c, n in company_counter.most_common(5)],
        "top_roles":    [{"role": r,    "count": n} for r, n in role_counter.most_common(5)],
        "upcoming_followups": upcoming_followups,
        "pipeline_health": (
            "Strong"       if offer_rate >= 10 else
            "Progressing"  if response_rate >= 20 else
            "Needs attention — improve targeting or application quality"
        ),
    }
