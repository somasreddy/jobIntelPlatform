"""
Market Radar API
AI-powered market intelligence — salary benchmarks, trending skills, role demand,
and a personalised weekly market briefing.
"""
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.auth import get_current_user_id
from core.llm import smart_chat
from models.database import CandidateProfile, CareerGoal

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SalaryBenchmarkRequest(BaseModel):
    role: str
    location: Optional[str] = None
    experience_years: Optional[int] = None
    skills: list[str] = []


class TrendingSkillsRequest(BaseModel):
    domain: Optional[str] = None   # e.g. "backend", "data", "product"
    level: Optional[str] = None    # "entry", "mid", "senior", "exec"


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/radar")
async def get_market_radar(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Personalised market radar briefing — trending skills, role demand,
    and salary movement for the user's target role.
    """
    profile_r = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    profile = profile_r.scalar_one_or_none()

    goals_r = await db.execute(
        select(CareerGoal).where(CareerGoal.user_id == user_id, CareerGoal.is_active == True)
    )
    goal = goals_r.scalar_one_or_none()

    target_role = (goal.target_role if goal else None) or (profile.current_role if profile else "Software Engineer")
    skills = list(profile.skills or []) if profile else []
    location = (profile.current_location if profile else None) or "Global"

    prompt = f"""You are a job market intelligence analyst. Generate a personalised market radar report for:
- Target role: {target_role}
- Key skills: {', '.join(skills[:10]) if skills else 'Not specified'}
- Location: {location}

Return ONLY valid JSON:
{{
  "role_demand": {{
    "trend": "rising|stable|declining",
    "score": 78,
    "summary": "2-sentence demand summary"
  }},
  "salary_movement": {{
    "direction": "up|flat|down",
    "pct_change": 8,
    "current_range": {{"min": 120000, "max": 180000, "currency": "USD"}},
    "summary": "salary trend note"
  }},
  "hot_skills": [
    {{"skill": "TypeScript", "demand_score": 92, "why": "short reason"}},
    {{"skill": "AWS", "demand_score": 88, "why": "short reason"}}
  ],
  "declining_skills": [
    {{"skill": "jQuery", "reason": "replaced by modern frameworks"}}
  ],
  "market_insight": "3-4 sentence market briefing relevant to the candidate",
  "action_items": ["action 1", "action 2", "action 3"]
}}"""

    try:
        data = await smart_chat(
            system="Return ONLY valid JSON. No markdown.",
            user=prompt,
            json_mode=True,
        )
        if isinstance(data, dict):
            data["target_role"] = target_role
            data["location"] = location
            return data
    except Exception as e:
        logger.warning(f"Market radar AI call failed: {e}")

    # Fallback
    return {
        "target_role": target_role,
        "location": location,
        "error": "Market data temporarily unavailable. Try again shortly.",
    }


@router.post("/salary-benchmark")
async def salary_benchmark(
    payload: SalaryBenchmarkRequest,
    _: uuid.UUID = Depends(get_current_user_id),
):
    """AI-generated salary benchmark for a role + location + experience."""
    prompt = f"""You are a compensation data analyst with access to current salary surveys.
Provide accurate salary benchmarks for:
- Role: {payload.role}
- Location: {payload.location or 'United States'}
- Experience: {payload.experience_years or 5} years
- Key skills: {', '.join(payload.skills[:8]) if payload.skills else 'Not specified'}

Return ONLY valid JSON:
{{
  "p25": 95000,
  "p50": 120000,
  "p75": 150000,
  "p90": 185000,
  "currency": "USD",
  "location": "United States",
  "total_comp_note": "note about equity/bonus typical for this role",
  "factors": ["factor that increases pay 1", "factor that decreases pay 1"],
  "remote_premium": "% premium or discount for remote"
}}"""

    try:
        data = await smart_chat(
            system="Return ONLY valid JSON. No markdown.",
            user=prompt,
            json_mode=True,
        )
        if isinstance(data, dict):
            return {"role": payload.role, **data}
    except Exception as e:
        logger.warning(f"Salary benchmark AI call failed: {e}")

    return {"error": "Benchmark data temporarily unavailable"}


@router.post("/trending-skills")
async def trending_skills(
    payload: TrendingSkillsRequest,
    _: uuid.UUID = Depends(get_current_user_id),
):
    """Return currently trending skills for a domain/level."""
    domain = payload.domain or "software engineering"
    level = payload.level or "mid"

    prompt = f"""You are a tech talent market analyst. List the top 15 most in-demand skills for {level}-level {domain} roles right now (2025-2026).
Return ONLY valid JSON:
{{
  "skills": [
    {{
      "name": "Python",
      "demand_score": 95,
      "yoy_growth": 12,
      "avg_salary_premium_pct": 15,
      "category": "Language",
      "note": "why this skill is hot"
    }}
  ]
}}"""

    try:
        data = await smart_chat(
            system="Return ONLY valid JSON. No markdown.",
            user=prompt,
            json_mode=True,
        )
        if isinstance(data, dict):
            return {"domain": domain, "level": level, **data}
    except Exception as e:
        logger.warning(f"Trending skills AI call failed: {e}")

    return {"error": "Trending data temporarily unavailable"}


@router.get("/role-demand")
async def role_demand(
    role: str = Query(..., min_length=2),
    location: Optional[str] = Query(None),
    _: uuid.UUID = Depends(get_current_user_id),
):
    """Quick demand signal for a specific role."""
    prompt = f"""Analyse job market demand for the role "{role}" in {location or 'Global'} as of 2025.
Return ONLY valid JSON:
{{
  "demand_score": 75,
  "trend": "rising",
  "open_roles_estimate": "50000+",
  "top_hiring_companies": ["Company A", "Company B", "Company C"],
  "top_locations": ["San Francisco", "New York", "Remote"],
  "summary": "2-3 sentence demand analysis"
}}"""

    try:
        data = await smart_chat(
            system="Return ONLY valid JSON. No markdown.",
            user=prompt,
            json_mode=True,
        )
        if isinstance(data, dict):
            return {"role": role, "location": location, **data}
    except Exception as e:
        logger.warning(f"Role demand AI call failed: {e}")

    return {"error": "Role demand data temporarily unavailable"}
