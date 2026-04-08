"""
Autopilot API
Scans top-fit jobs → generates resume + cover letter → queues for user approval.
"""
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.auth import get_current_user_id
from core.llm import smart_chat
from models.database import (
    AutopilotSettings, AutopilotQueueItem,
    VerifiedJob, CandidateProfile, CareerGoal,
)
from services.fit_score import compute_fit_score

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SettingsUpsert(BaseModel):
    enabled: Optional[bool] = None
    min_fit_score: Optional[int] = None
    max_per_day: Optional[int] = None
    exclude_companies: Optional[List[str]] = None
    require_approval: Optional[bool] = None


class ActionRequest(BaseModel):
    action: str   # "approve" | "skip"


# ─── Settings ─────────────────────────────────────────────────────────────────

@router.get("/settings")
async def get_settings(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AutopilotSettings).where(AutopilotSettings.user_id == user_id)
    )
    s = result.scalar_one_or_none()
    if not s:
        return {"enabled": False, "min_fit_score": 75, "max_per_day": 5,
                "exclude_companies": [], "require_approval": True}
    return _settings_to_dict(s)


@router.put("/settings")
async def upsert_settings(
    payload: SettingsUpsert,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AutopilotSettings).where(AutopilotSettings.user_id == user_id)
    )
    s = result.scalar_one_or_none()
    if not s:
        s = AutopilotSettings(user_id=user_id)
        db.add(s)

    if payload.enabled is not None:
        s.enabled = payload.enabled
    if payload.min_fit_score is not None:
        s.min_fit_score = max(0, min(100, payload.min_fit_score))
    if payload.max_per_day is not None:
        s.max_per_day = max(1, min(20, payload.max_per_day))
    if payload.exclude_companies is not None:
        s.exclude_companies = payload.exclude_companies
    if payload.require_approval is not None:
        s.require_approval = payload.require_approval

    await db.flush()
    return _settings_to_dict(s)


# ─── Queue ────────────────────────────────────────────────────────────────────

@router.get("/queue")
async def get_queue(
    status: Optional[str] = None,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AutopilotQueueItem).where(AutopilotQueueItem.user_id == user_id)
    if status:
        stmt = stmt.where(AutopilotQueueItem.status == status)
    stmt = stmt.order_by(AutopilotQueueItem.created_at.desc()).limit(50)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return {
        "queue": [_item_to_dict(i) for i in items],
        "pending_count": sum(1 for i in items if i.status == "pending"),
        "approved_count": sum(1 for i in items if i.status == "approved"),
        "skipped_count": sum(1 for i in items if i.status == "skipped"),
    }


@router.post("/queue/{item_id}/action")
async def action_item(
    item_id: uuid.UUID,
    payload: ActionRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AutopilotQueueItem).where(
            AutopilotQueueItem.id == item_id,
            AutopilotQueueItem.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Queue item not found")

    if payload.action not in ("approve", "skip"):
        raise HTTPException(400, "action must be 'approve' or 'skip'")

    item.status = "approved" if payload.action == "approve" else "skipped"
    item.actioned_at = datetime.now(timezone.utc)
    return _item_to_dict(item)


# ─── Run scan (trigger manually or on schedule) ───────────────────────────────

@router.post("/scan")
async def run_autopilot_scan(
    background_tasks: BackgroundTasks,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Scan top-fit jobs and enqueue them for autopilot processing.
    Generates resume+cover letter for the top candidates.
    Returns immediately; generation runs in background.
    """
    settings_r = await db.execute(
        select(AutopilotSettings).where(AutopilotSettings.user_id == user_id)
    )
    settings = settings_r.scalar_one_or_none()
    if not settings or not settings.enabled:
        raise HTTPException(400, "Autopilot is not enabled. Enable it in settings first.")

    profile_r = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    profile = profile_r.scalar_one_or_none()
    if not profile:
        raise HTTPException(400, "Complete your profile before using Autopilot.")

    goal_r = await db.execute(
        select(CareerGoal).where(CareerGoal.user_id == user_id, CareerGoal.is_active == True)
    )
    goal = goal_r.scalar_one_or_none()

    # Get recent jobs not yet in queue for this user
    existing_r = await db.execute(
        select(AutopilotQueueItem.job_id).where(
            AutopilotQueueItem.user_id == user_id,
            AutopilotQueueItem.created_at >= datetime.now(timezone.utc) - timedelta(days=7),
        )
    )
    existing_job_ids = {row[0] for row in existing_r.all()}

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    jobs_r = await db.execute(
        select(VerifiedJob)
        .where(VerifiedJob.created_at >= cutoff)
        .order_by(VerifiedJob.created_at.desc())
        .limit(100)
    )
    recent_jobs = jobs_r.scalars().all()

    # Score + filter
    exclude = [c.lower() for c in (settings.exclude_companies or [])]
    candidates = []
    for job in recent_jobs:
        if job.id in existing_job_ids:
            continue
        if job.organization and job.organization.lower() in exclude:
            continue
        fit = compute_fit_score(
            user_skills=list(profile.skills or []),
            user_frameworks=list(profile.frameworks or []),
            user_languages=list(profile.languages or []),
            user_experience_years=profile.experience_years,
            user_preferred_locations=list(profile.preferred_locations or []),
            user_work_mode=profile.work_mode,
            user_current_salary=profile.current_salary,
            user_target_role=goal.target_role if goal else None,
            user_target_salary_min=goal.target_salary_min if goal else None,
            job_title=job.title or "",
            job_description=job.description or "",
            job_requirements=list(job.requirements or []) + list(job.technologies or []),
            job_experience_required=job.experience_required,
            job_location=job.location,
            job_work_mode=job.work_mode,
            job_salary_min=job.salary_min,
            job_salary_max=job.salary_max,
        )
        if fit["fit_score"] >= settings.min_fit_score:
            candidates.append((job, fit["fit_score"]))

    # Take top N
    candidates.sort(key=lambda x: x[1], reverse=True)
    top = candidates[: settings.max_per_day]

    enqueued = []
    for job, score in top:
        item = AutopilotQueueItem(
            user_id=user_id,
            job_id=job.id,
            job_title=job.title or "",
            job_org=job.organization,
            job_location=job.location,
            fit_score=score,
            status="pending",
        )
        db.add(item)
        enqueued.append(item)

    await db.flush()

    # Snapshot immutable data needed by background tasks (avoid closed-session issues)
    profile_snapshot = {
        "full_name": getattr(profile, "full_name", "") or "",
        "experience_years": profile.experience_years or 0,
        "skills": list(profile.skills or []),
    }

    # Generate resume+cover letter for top 3 in background
    for item in enqueued[:3]:
        job_obj = next(j for j, _ in top if j.id == item.job_id)
        job_snapshot = {
            "title": job_obj.title or "",
            "organization": job_obj.organization or "",
            "location": job_obj.location or "",
            "description": (job_obj.description or "")[:500],
        }
        background_tasks.add_task(
            _generate_materials, item.id, profile_snapshot, job_snapshot
        )

    return {
        "scanned": len(recent_jobs),
        "qualified": len(candidates),
        "enqueued": len(enqueued),
        "queue_items": [_item_to_dict(i) for i in enqueued],
    }


# ─── Background generation ────────────────────────────────────────────────────

async def _generate_materials(
    item_id: uuid.UUID,
    profile: dict,
    job: dict,
):
    """
    Generate ATS resume + cover letter for a queued item.
    Opens its own DB session so it's safe to run as a background task
    after the request session has closed.
    """
    from core.database import AsyncSessionLocal
    try:
        resume_prompt = f"""Generate an ATS-optimised resume summary for:
Candidate: {profile['full_name']}, {profile['experience_years']}yr exp
Skills: {", ".join(profile['skills'])}
Target role: {job['title']} at {job['organization']}
Job description: {job['description']}

Return ONLY the resume summary text (3-4 sentences), no markdown."""

        cover_prompt = f"""Write a concise cover letter (3 short paragraphs) for:
Candidate: {profile['full_name']}
Role: {job['title']} at {job['organization']}
Key skills: {", ".join(profile['skills'][:6])}
Location: {job['location']}

Be direct and compelling. Return plain text only."""

        resume_text = await smart_chat(
            system="You are an expert resume writer. Return plain text only.",
            user=resume_prompt,
            json_mode=False,
        )
        cover_text = await smart_chat(
            system="You are a professional cover letter writer. Return plain text only.",
            user=cover_prompt,
            json_mode=False,
        )

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(AutopilotQueueItem).where(AutopilotQueueItem.id == item_id)
            )
            item = result.scalar_one_or_none()
            if item:
                item.generated_resume = resume_text if isinstance(resume_text, str) else str(resume_text)
                item.generated_cover_letter = cover_text if isinstance(cover_text, str) else str(cover_text)
                await session.commit()
    except Exception as exc:
        logger.warning(f"Autopilot material generation failed for {item_id}: {exc}")


# ─── Serialisers ──────────────────────────────────────────────────────────────

def _settings_to_dict(s: AutopilotSettings) -> dict:
    return {
        "enabled": s.enabled,
        "min_fit_score": s.min_fit_score,
        "max_per_day": s.max_per_day,
        "exclude_companies": s.exclude_companies or [],
        "require_approval": s.require_approval,
    }


def _item_to_dict(i: AutopilotQueueItem) -> dict:
    return {
        "id": str(i.id),
        "job_id": str(i.job_id),
        "job_title": i.job_title,
        "job_org": i.job_org,
        "job_location": i.job_location,
        "fit_score": i.fit_score,
        "status": i.status,
        "has_resume": bool(i.generated_resume),
        "has_cover_letter": bool(i.generated_cover_letter),
        "generated_resume": i.generated_resume,
        "generated_cover_letter": i.generated_cover_letter,
        "created_at": i.created_at.isoformat() if i.created_at else None,
        "actioned_at": i.actioned_at.isoformat() if i.actioned_at else None,
    }
