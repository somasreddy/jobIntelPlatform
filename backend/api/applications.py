import uuid
import logging
from typing import Optional
from datetime import datetime, timezone
from collections import Counter
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from core.database import get_db
from models.database import Application, VerifiedJob

logger = logging.getLogger(__name__)
router = APIRouter()

# Temporary user_id until auth is implemented
_DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class ApplicationCreate(BaseModel):
    job_id: str
    status: str = "Saved"
    notes: Optional[str] = None
    follow_up_date: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    follow_up_date: Optional[str] = None


def _app_to_dict(app: Application) -> dict:
    job = app.job
    return {
        "id": str(app.id),
        "jobId": str(app.job_id) if app.job_id else None,
        "status": app.status,
        "dateApplied": str(app.date_applied)[:10] if app.date_applied else None,
        "followUpDate": str(app.follow_up_date)[:10] if app.follow_up_date else None,
        "notes": app.notes,
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
        } if job else None,
    }


@router.get("/")
async def get_applications(
    user_id: str = Query(str(_DEMO_USER_ID)),
    db: AsyncSession = Depends(get_db),
):
    """Get all job applications for the user."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        uid = _DEMO_USER_ID
    stmt = (
        select(Application)
        .where(Application.user_id == uid)
        .order_by(Application.created_at.desc())
    )
    result = await db.execute(stmt)
    apps = result.scalars().all()
    # Eagerly load jobs
    output = []
    for app in apps:
        if app.job_id:
            job_result = await db.execute(
                select(VerifiedJob).where(VerifiedJob.id == app.job_id)
            )
            app.job = job_result.scalar_one_or_none()
        output.append(_app_to_dict(app))
    return output


@router.post("/")
async def create_application(
    payload: ApplicationCreate, db: AsyncSession = Depends(get_db)
):
    """Create a new job application tracking entry."""
    try:
        job_uid = uuid.UUID(payload.job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id")

    follow_up = None
    if payload.follow_up_date:
        try:
            follow_up = datetime.fromisoformat(payload.follow_up_date)
        except ValueError:
            pass

    app = Application(
        user_id=_DEMO_USER_ID,
        job_id=job_uid,
        status=payload.status,
        notes=payload.notes,
        date_applied=datetime.utcnow() if payload.status == "Applied" else None,
        follow_up_date=follow_up,
    )
    db.add(app)
    await db.flush()
    await db.refresh(app)
    return {"id": str(app.id), "status": app.status, "job_id": payload.job_id}


@router.patch("/{app_id}")
async def update_application(
    app_id: str,
    payload: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update status, notes, or follow-up date of an application."""
    try:
        uid = uuid.UUID(app_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid app ID")

    result = await db.execute(select(Application).where(Application.id == uid))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if payload.status is not None:
        app.status = payload.status
        if payload.status == "Applied" and not app.date_applied:
            app.date_applied = datetime.utcnow()
    if payload.notes is not None:
        app.notes = payload.notes
    if payload.follow_up_date is not None:
        try:
            app.follow_up_date = datetime.fromisoformat(payload.follow_up_date)
        except ValueError:
            pass

    await db.flush()
    return {"id": str(app.id), "status": app.status}


@router.delete("/{app_id}")
async def delete_application(app_id: str, db: AsyncSession = Depends(get_db)):
    """Delete an application tracking entry."""
    try:
        uid = uuid.UUID(app_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid app ID")
    result = await db.execute(select(Application).where(Application.id == uid))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    await db.delete(app)
    return {"deleted": str(uid)}


@router.get("/analytics")
async def get_application_analytics(
    user_id: str = Query(str(_DEMO_USER_ID)),
    db: AsyncSession = Depends(get_db),
):
    """
    Return pipeline analytics: stage breakdown, response rate, offer rate,
    avg days to apply, top companies/roles applied to.
    """
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        uid = _DEMO_USER_ID

    stmt = select(Application).where(Application.user_id == uid)
    result = await db.execute(stmt)
    apps = result.scalars().all()

    if not apps:
        return {"message": "No applications found", "total": 0}

    # Stage breakdown
    stage_counter = Counter(a.status for a in apps)
    all_stages = ["Saved", "Applied", "Assessment", "Interview", "Offer", "Rejected"]
    stage_breakdown = {s: stage_counter.get(s, 0) for s in all_stages}

    total = len(apps)
    applied_count = sum(stage_counter.get(s, 0) for s in ["Applied", "Assessment", "Interview", "Offer", "Rejected"])
    responded_count = sum(stage_counter.get(s, 0) for s in ["Assessment", "Interview", "Offer"])
    offer_count = stage_counter.get("Offer", 0)

    response_rate = round((responded_count / applied_count * 100), 1) if applied_count > 0 else 0
    offer_rate = round((offer_count / applied_count * 100), 1) if applied_count > 0 else 0

    # Avg days from Saved → Applied
    days_to_apply = []
    for a in apps:
        if a.date_applied and a.created_at:
            delta = (a.date_applied.replace(tzinfo=timezone.utc) - a.created_at.replace(tzinfo=timezone.utc)).days
            if delta >= 0:
                days_to_apply.append(delta)
    avg_days_to_apply = round(sum(days_to_apply) / len(days_to_apply), 1) if days_to_apply else None

    # Top companies & roles — load jobs
    company_counter: Counter = Counter()
    role_counter: Counter = Counter()
    for a in apps:
        if a.job_id:
            job_res = await db.execute(select(VerifiedJob).where(VerifiedJob.id == a.job_id))
            job = job_res.scalar_one_or_none()
            if job:
                company_counter[job.organization] += 1
                role_counter[job.title] += 1

    # Follow-ups due (in next 7 days)
    now = datetime.now(timezone.utc)
    upcoming_followups = [
        {
            "app_id": str(a.id),
            "follow_up_date": str(a.follow_up_date)[:10],
        }
        for a in apps
        if a.follow_up_date and 0 <= (a.follow_up_date.replace(tzinfo=timezone.utc) - now).days <= 7
    ]

    return {
        "total": total,
        "stage_breakdown": stage_breakdown,
        "response_rate_pct": response_rate,
        "offer_rate_pct": offer_rate,
        "avg_days_to_apply": avg_days_to_apply,
        "top_companies": [{"company": c, "count": n} for c, n in company_counter.most_common(5)],
        "top_roles": [{"role": r, "count": n} for r, n in role_counter.most_common(5)],
        "upcoming_followups": upcoming_followups,
        "pipeline_health": (
            "Strong" if offer_rate >= 10 else
            "Progressing" if response_rate >= 20 else
            "Needs attention — focus on improving application quality or targeting"
        ),
    }
