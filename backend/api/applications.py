import uuid
import logging
from typing import Optional
from datetime import datetime
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
