import uuid
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from models.database import VerifiedJob
from recruiter_engine.engine import RecruiterEngine

router = APIRouter()
_engine = RecruiterEngine()


@router.post("/outreach-message")
async def generate_outreach_message(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a personalized LinkedIn outreach message to the recruiter.
    Body: { profile: {...}, job_id: str } OR { profile: {...}, job: {...} }
    """
    profile = payload.get("profile", {})
    job_data = payload.get("job")

    if not job_data:
        job_id = payload.get("job_id")
        if not job_id:
            raise HTTPException(status_code=400, detail="Provide job_id or job object")
        try:
            uid = uuid.UUID(job_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid job_id")
        result = await db.execute(select(VerifiedJob).where(VerifiedJob.id == uid))
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Job not found")
        job_data = {
            "title": row.title,
            "organization": row.organization,
            "description": row.description,
            "technologies": row.technologies or [],
            "recruiter_name": row.recruiter_name,
            "recruiter_linkedin": row.recruiter_linkedin,
        }

    result = await _engine.generate_outreach_message(job_data, profile)
    return result
