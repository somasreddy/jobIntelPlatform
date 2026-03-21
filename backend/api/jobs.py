import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.config import settings
from models.database import VerifiedJob
from models.schemas import JobCreate
from job_discovery.service import JobDiscoveryService

logger = logging.getLogger(__name__)
router = APIRouter()


def _row_to_dict(job: VerifiedJob) -> dict:
    return {
        "id": str(job.id),
        "title": job.title,
        "organization": job.organization,
        "location": job.location,
        "workMode": job.work_mode,
        "salaryMin": job.salary_min,
        "salaryMax": job.salary_max,
        "currency": job.currency or "USD",
        "experienceRequired": job.experience_required,
        "description": job.description,
        "technologies": job.technologies or [],
        "applicationLink": job.application_link,
        "careerPageLink": job.career_page_link,
        "recruiterName": job.recruiter_name,
        "recruiterLinkedIn": job.recruiter_linkedin,
        "verificationStatus": job.verification_status,
        "levelUp": job.level_up,
        "matchScore": job.match_score,
        "postedDate": job.posted_date or str(job.created_at)[:10],
        "source": getattr(job, "source", None),
    }


@router.get("/")
async def get_jobs(
    search: Optional[str] = Query(None),
    work_mode: Optional[str] = Query(None),
    tech: Optional[str] = Query(None),
    source: Optional[str] = Query(None),          # portal filter e.g. "LinkedIn"
    min_match_score: int = Query(0, ge=0, le=100), # strict score filter
    verified_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get all discovered jobs with optional filters. Only returns jobs from the last 7 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    stmt = select(VerifiedJob).where(VerifiedJob.created_at >= cutoff)
    if verified_only:
        stmt = stmt.where(VerifiedJob.verification_status == "VERIFIED")
    if work_mode and work_mode != "All":
        stmt = stmt.where(VerifiedJob.work_mode == work_mode)
    if search:
        q = f"%{search.lower()}%"
        stmt = stmt.where(
            func.lower(VerifiedJob.title).like(q)
            | func.lower(VerifiedJob.organization).like(q)
        )
    stmt = stmt.order_by(VerifiedJob.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    rows = [_row_to_dict(j) for j in result.scalars().all()]

    # Post-filter: tech tag
    if tech and tech != "All":
        rows = [r for r in rows if tech in (r.get("technologies") or [])]
    # Post-filter: source portal
    if source and source != "All":
        rows = [r for r in rows if r.get("source") == source]
    # Post-filter: minimum match score
    if min_match_score > 0:
        rows = [r for r in rows if (r.get("matchScore") or 0) >= min_match_score]

    return rows


@router.get("/verified")
async def get_verified_jobs(
    skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)
):
    """Get only verified jobs."""
    stmt = (
        select(VerifiedJob)
        .where(VerifiedJob.verification_status == "VERIFIED")
        .order_by(VerifiedJob.created_at.desc())
        .offset(skip).limit(limit)
    )
    result = await db.execute(stmt)
    return [_row_to_dict(j) for j in result.scalars().all()]


@router.post("/discover")
async def discover_jobs(payload: dict = Body(...)):
    """
    Live multi-portal job discovery.

    Accepts a profile payload and returns best-matched jobs scraped from
    Remotive, Arbeitnow, The Muse, Adzuna (free) and optionally JSearch
    (RapidAPI — aggregates LinkedIn / Indeed / Glassdoor / Naukri).

    Payload fields (all optional):
      role           – candidate's current / target role
      skills         – list of skill strings
      frameworks     – list of framework strings
      cicd_tools     – list of CI/CD tool strings
      languages      – list of language strings
      experience_years – integer
      location       – preferred location string
      work_mode      – "Remote" | "Hybrid" | "On-site" | "Any"
      min_match_score  – 0-100, default 60
      run_verification – bool, default true (HEAD-ping every app link)
    """
    svc = JobDiscoveryService(
        adzuna_app_id=settings.ADZUNA_APP_ID,
        adzuna_app_key=settings.ADZUNA_APP_KEY,
        jsearch_api_key=settings.JSEARCH_API_KEY,
    )

    profile_skills = (
        (payload.get("skills") or [])
        + (payload.get("frameworks") or [])
        + (payload.get("cicd_tools") or [])
        + (payload.get("languages") or [])
    )

    jobs = await svc.discover_jobs(
        role=payload.get("role", ""),
        location=payload.get("location", ""),
        profile_skills=profile_skills,
        exp_years=int(payload.get("experience_years") or 0),
        min_match_score=int(payload.get("min_match_score") or 60),
        run_verification=bool(payload.get("run_verification", True)),
    )

    return jobs


@router.get("/{job_id}")
async def get_job_details(job_id: str, db: AsyncSession = Depends(get_db)):
    """Get details for a specific job."""
    try:
        uid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job ID format")
    result = await db.execute(select(VerifiedJob).where(VerifiedJob.id == uid))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _row_to_dict(job)


@router.post("/")
async def create_job(payload: JobCreate, db: AsyncSession = Depends(get_db)):
    """Create / ingest a new job (used by discovery worker)."""
    job = VerifiedJob(
        title=payload.title,
        organization=payload.organization,
        location=payload.location,
        work_mode=payload.work_mode,
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        currency=payload.currency,
        experience_required=payload.experience_required,
        description=payload.description,
        technologies=payload.technologies,
        application_link=payload.application_link,
        career_page_link=payload.career_page_link,
        verification_status=payload.verification_status,
    )
    db.add(job)
    await db.flush()
    await db.refresh(job)
    return _row_to_dict(job)


@router.post("/match-score")
async def compute_match_score(payload: dict = Body(...)):
    """Compute skill-overlap match score between a profile and a job."""
    profile = payload.get("profile", {})
    job = payload.get("job", {})
    p_skills = set(
        s.lower() for s in (
            (profile.get("skills") or [])
            + (profile.get("frameworks") or [])
            + (profile.get("cicd_tools") or [])
            + (profile.get("languages") or [])
        )
    )
    j_techs = set(t.lower() for t in (job.get("technologies") or []))
    if not j_techs:
        return {"score": 70}
    overlap = len(p_skills & j_techs)
    score = int((overlap / len(j_techs)) * 100)
    exp_req = job.get("experience_required") or 0
    cand_exp = profile.get("experience_years") or 0
    if cand_exp >= exp_req:
        score = min(99, score + 10)
    elif cand_exp < exp_req - 2:
        score = max(10, score - 15)
    return {"score": score, "overlap": list(p_skills & j_techs), "missing": list(j_techs - p_skills)}
