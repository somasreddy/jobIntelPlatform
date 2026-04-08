"""
Insights & Analytics API
Application funnel, response rates, rejection analysis, career progress.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.auth import get_current_user_id
from core.llm import smart_chat
from models.database import Application, VerifiedJob, MasterStory, CareerGraph

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Application Funnel ───────────────────────────────────────────────────────

@router.get("/funnel")
async def application_funnel(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Application pipeline funnel with stage counts and conversion rates."""
    result = await db.execute(
        select(Application).where(Application.user_id == user_id)
    )
    apps = result.scalars().all()

    stages = ["Saved", "Applied", "Assessment", "Screening", "Interview", "Offer", "Rejected"]
    counts: dict[str, int] = defaultdict(int)
    for a in apps:
        counts[a.status] += 1

    # Conversion rates
    applied = counts.get("Applied", 0) + counts.get("Assessment", 0) + counts.get("Screening", 0) + counts.get("Interview", 0) + counts.get("Offer", 0) + counts.get("Rejected", 0)
    interviews = counts.get("Interview", 0) + counts.get("Offer", 0)
    offers = counts.get("Offer", 0)

    now = datetime.now(timezone.utc)
    last_30 = [a for a in apps if a.created_at and (now - a.created_at).days <= 30]
    last_7  = [a for a in apps if a.created_at and (now - a.created_at).days <= 7]

    return {
        "total": len(apps),
        "last_30_days": len(last_30),
        "last_7_days": len(last_7),
        "funnel": {stage: counts.get(stage, 0) for stage in stages},
        "rates": {
            "application_to_interview": round(interviews / max(applied, 1) * 100, 1),
            "interview_to_offer": round(offers / max(interviews, 1) * 100, 1),
            "overall_offer_rate": round(offers / max(applied, 1) * 100, 1),
        },
    }


@router.get("/timeline")
async def application_timeline(
    days: int = 90,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Daily application count for the past N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(Application)
        .where(Application.user_id == user_id, Application.created_at >= cutoff)
    )
    apps = result.scalars().all()

    daily: dict[str, int] = defaultdict(int)
    for a in apps:
        if a.created_at:
            day = a.created_at.strftime("%Y-%m-%d")
            daily[day] += 1

    # Fill gaps
    timeline = []
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - i - 1)).strftime("%Y-%m-%d")
        timeline.append({"date": d, "count": daily.get(d, 0)})

    return {"timeline": timeline}


@router.get("/response-rates")
async def response_rates(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Response rates broken down by work mode, source, and seniority."""
    result = await db.execute(
        select(Application, VerifiedJob)
        .join(VerifiedJob, Application.job_id == VerifiedJob.id, isouter=True)
        .where(Application.user_id == user_id)
    )
    pairs = result.all()

    responded = 0
    by_work_mode: dict[str, dict] = defaultdict(lambda: {"total": 0, "responded": 0})

    for app, job in pairs:
        moved = app.status not in {"Saved", "Applied"}
        responded += 1 if moved else 0
        if job:
            wm = job.work_mode or "Unknown"
            by_work_mode[wm]["total"] += 1
            by_work_mode[wm]["responded"] += 1 if moved else 0

    total = len(pairs)
    return {
        "overall_response_rate": round(responded / max(total, 1) * 100, 1),
        "by_work_mode": {
            k: {
                "total": v["total"],
                "responded": v["responded"],
                "rate": round(v["responded"] / max(v["total"], 1) * 100, 1),
            }
            for k, v in by_work_mode.items()
        },
    }


@router.get("/story-bank")
async def story_bank_stats(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Story bank usage stats."""
    result = await db.execute(
        select(MasterStory).where(MasterStory.user_id == user_id)
    )
    stories = result.scalars().all()

    themes = defaultdict(int)
    for s in stories:
        for tag in (s.archetype_tags or []):
            themes[str(tag)] += 1

    return {
        "total_stories": len(stories),
        "readiness": "ready" if len(stories) >= 10 else "building" if len(stories) >= 5 else "needs_work",
        "top_themes": sorted(themes.items(), key=lambda x: x[1], reverse=True)[:5],
    }


# ─── Rejection Analyzer ───────────────────────────────────────────────────────

class RejectionAnalysisRequest(BaseModel):
    job_title: str
    job_description: str = ""
    application_id: Optional[str] = None
    rejection_note: Optional[str] = None   # any message or reason given
    resume_text: Optional[str] = None


@router.post("/rejection-analysis")
async def rejection_analysis(
    payload: RejectionAnalysisRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    AI-powered rejection analysis — pattern detection, hypothesis,
    resume issues, timing issues, and a concrete fix plan.
    """
    # Gather user's rejection history for pattern detection
    result = await db.execute(
        select(Application).where(
            Application.user_id == user_id,
            Application.status == "Rejected",
        )
    )
    rejections = result.scalars().all()

    rejection_context = f"User has {len(rejections)} total rejections."
    if payload.rejection_note:
        rejection_context += f"\nRejection message: {payload.rejection_note}"

    prompt = f"""You are a senior career coach and talent acquisition expert who has seen thousands of rejections.
Analyse this rejection and help the candidate understand what went wrong and how to fix it.

Role: {payload.job_title}
{f"Job Description (excerpt): {payload.job_description[:500]}" if payload.job_description else ""}
{f"Resume Text (excerpt): {payload.resume_text[:500]}" if payload.resume_text else ""}
{rejection_context}

Return ONLY valid JSON:
{{
  "most_likely_reason": "The primary reason for rejection (be specific and honest)",
  "hypotheses": [
    {{"hypothesis": "reason 1", "probability": "High", "evidence": "what suggests this"}},
    {{"hypothesis": "reason 2", "probability": "Medium", "evidence": "what suggests this"}}
  ],
  "resume_issues": ["specific resume problem 1", "problem 2"],
  "timing_issues": ["any timing-related factors"],
  "what_went_well": ["things that likely impressed them"],
  "fix_plan": [
    {{"action": "specific action to take", "priority": "High", "timeframe": "This week"}}
  ],
  "reapply_in": "How long to wait before reapplying (if ever)",
  "morale_boost": "Honest but encouraging closing message"
}}"""

    try:
        data = await smart_chat(
            system="You are a frank but compassionate career coach. Return ONLY valid JSON.",
            user=prompt,
            json_mode=True,
        )
        if isinstance(data, dict):
            data["job_title"] = payload.job_title
            data["total_rejections"] = len(rejections)
            return data
    except Exception as e:
        logger.warning(f"Rejection analysis AI call failed: {e}")

    return {"error": "Analysis temporarily unavailable"}


# ─── Career Health History ────────────────────────────────────────────────────

@router.get("/health-history")
async def health_history(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Current career health score snapshot."""
    result = await db.execute(
        select(CareerGraph).where(CareerGraph.user_id == user_id)
    )
    graph = result.scalar_one_or_none()
    if not graph:
        return {"health_score": 0, "breakdown": {}, "computed_at": None}

    return {
        "health_score": graph.health_score,
        "breakdown": graph.health_breakdown or {},
        "computed_at": graph.last_computed.isoformat() if graph.last_computed else None,
    }
