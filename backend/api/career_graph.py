"""
Career Graph API
Endpoints for the user's persistent career DNA model — health score, skills,
goals, milestones, and fit scores.
"""
import uuid
import logging
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.auth import get_current_user_id
from models.database import (
    CareerGraph,
    CareerSkill,
    CareerGoal,
    CareerMilestone,
    CandidateProfile,
)
from services.career_health import compute_career_health
from services.fit_score import compute_fit_score

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _get_or_create_graph(user_id: uuid.UUID, db: AsyncSession) -> CareerGraph:
    result = await db.execute(
        select(CareerGraph).where(CareerGraph.user_id == user_id)
    )
    graph = result.scalar_one_or_none()
    if graph is None:
        graph = CareerGraph(user_id=user_id)
        db.add(graph)
        await db.flush()
    return graph


# ─── Schemas ─────────────────────────────────────────────────────────────────

class SkillUpsert(BaseModel):
    skill_name: str
    category: Optional[str] = None
    level: int = 1                      # 1-5
    verified: bool = False
    last_used_year: Optional[int] = None
    trending_score: float = 0.0
    years_experience: float = 0.0


class GoalUpsert(BaseModel):
    target_role: Optional[str] = None
    target_company: Optional[str] = None
    target_salary_min: Optional[int] = None
    target_salary_max: Optional[int] = None
    target_location: Optional[str] = None
    timeline_months: Optional[int] = None
    work_mode: Optional[str] = None


class MilestoneCreate(BaseModel):
    type: str                           # job_change | promotion | cert | project | education
    title: str
    company: Optional[str] = None
    milestone_date: Optional[str] = None   # YYYY-MM
    impact_statement: Optional[str] = None


class FitScoreRequest(BaseModel):
    job_title: str
    job_description: str = ""
    job_requirements: List[str] = []
    job_experience_required: Optional[int] = None
    job_location: Optional[str] = None
    job_work_mode: Optional[str] = None
    job_salary_min: Optional[int] = None
    job_salary_max: Optional[int] = None


# ─── Graph Overview ───────────────────────────────────────────────────────────

@router.get("/")
async def get_career_graph(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the full career graph with health score, skills, goals, milestones."""
    graph = await _get_or_create_graph(user_id, db)

    skills_r = await db.execute(select(CareerSkill).where(CareerSkill.user_id == user_id))
    skills = skills_r.scalars().all()

    goals_r = await db.execute(select(CareerGoal).where(CareerGoal.user_id == user_id))
    goals = goals_r.scalars().all()

    milestones_r = await db.execute(select(CareerMilestone).where(CareerMilestone.user_id == user_id))
    milestones = milestones_r.scalars().all()

    return {
        "graph_id": str(graph.id),
        "health_score": graph.health_score,
        "health_breakdown": graph.health_breakdown or {},
        "market_position_score": graph.market_position_score,
        "onboarding_complete": graph.onboarding_complete,
        "last_computed": graph.last_computed.isoformat() if graph.last_computed else None,
        "skills": [_skill_to_dict(s) for s in skills],
        "goals": [_goal_to_dict(g) for g in goals],
        "milestones": [_milestone_to_dict(m) for m in milestones],
    }


@router.post("/compute-health")
async def recompute_health(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Trigger a health score recomputation and persist the result."""
    graph = await _get_or_create_graph(user_id, db)
    result = await compute_career_health(user_id, db, graph=graph)
    return result


# ─── Skills ──────────────────────────────────────────────────────────────────

@router.get("/skills")
async def list_skills(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CareerSkill).where(CareerSkill.user_id == user_id))
    return [_skill_to_dict(s) for s in result.scalars().all()]


@router.put("/skills")
async def upsert_skills(
    payload: List[SkillUpsert],
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Replace the full skills list for the user (upsert by skill_name)."""
    graph = await _get_or_create_graph(user_id, db)

    existing_r = await db.execute(select(CareerSkill).where(CareerSkill.user_id == user_id))
    existing = {s.skill_name.lower(): s for s in existing_r.scalars().all()}

    for item in payload:
        key = item.skill_name.lower()
        if key in existing:
            sk = existing[key]
            sk.category = item.category
            sk.level = max(1, min(5, item.level))
            sk.verified = item.verified
            sk.last_used_year = item.last_used_year
            sk.trending_score = item.trending_score
            sk.years_experience = item.years_experience
        else:
            sk = CareerSkill(
                graph_id=graph.id,
                user_id=user_id,
                skill_name=item.skill_name,
                category=item.category,
                level=max(1, min(5, item.level)),
                verified=item.verified,
                last_used_year=item.last_used_year,
                trending_score=item.trending_score,
                years_experience=item.years_experience,
            )
            db.add(sk)

    return {"updated": len(payload)}


@router.delete("/skills/{skill_name}")
async def delete_skill(
    skill_name: str,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CareerSkill).where(
            CareerSkill.user_id == user_id,
            CareerSkill.skill_name.ilike(skill_name),
        )
    )
    skill = result.scalar_one_or_none()
    if not skill:
        raise HTTPException(404, "Skill not found")
    await db.delete(skill)
    return {"deleted": skill_name}


# ─── Goals ───────────────────────────────────────────────────────────────────

@router.get("/goals")
async def list_goals(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CareerGoal).where(CareerGoal.user_id == user_id))
    return [_goal_to_dict(g) for g in result.scalars().all()]


@router.put("/goals")
async def upsert_goal(
    payload: GoalUpsert,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Upsert the user's primary (active) career goal."""
    graph = await _get_or_create_graph(user_id, db)

    result = await db.execute(
        select(CareerGoal).where(CareerGoal.user_id == user_id, CareerGoal.is_active == True)
    )
    goal = result.scalar_one_or_none()

    if goal is None:
        goal = CareerGoal(graph_id=graph.id, user_id=user_id)
        db.add(goal)

    goal.target_role = payload.target_role
    goal.target_company = payload.target_company
    goal.target_salary_min = payload.target_salary_min
    goal.target_salary_max = payload.target_salary_max
    goal.target_location = payload.target_location
    goal.timeline_months = payload.timeline_months
    goal.work_mode = payload.work_mode
    goal.is_active = True

    return {"updated": True}


# ─── Milestones ──────────────────────────────────────────────────────────────

@router.get("/milestones")
async def list_milestones(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CareerMilestone)
        .where(CareerMilestone.user_id == user_id)
        .order_by(CareerMilestone.milestone_date.desc().nullslast())
    )
    return [_milestone_to_dict(m) for m in result.scalars().all()]


@router.post("/milestones")
async def add_milestone(
    payload: MilestoneCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    graph = await _get_or_create_graph(user_id, db)
    milestone = CareerMilestone(
        graph_id=graph.id,
        user_id=user_id,
        type=payload.type,
        title=payload.title,
        company=payload.company,
        milestone_date=payload.milestone_date,
        impact_statement=payload.impact_statement,
    )
    db.add(milestone)
    await db.flush()
    return _milestone_to_dict(milestone)


@router.delete("/milestones/{milestone_id}")
async def delete_milestone(
    milestone_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CareerMilestone).where(
            CareerMilestone.id == milestone_id,
            CareerMilestone.user_id == user_id,
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(404, "Milestone not found")
    await db.delete(m)
    return {"deleted": str(milestone_id)}


# ─── Fit Score ───────────────────────────────────────────────────────────────

@router.post("/fit-score")
async def get_fit_score(
    payload: FitScoreRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Compute a fit score for a job against the user's live profile + goals."""
    profile_r = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    profile = profile_r.scalar_one_or_none()

    goals_r = await db.execute(
        select(CareerGoal).where(CareerGoal.user_id == user_id, CareerGoal.is_active == True)
    )
    goal = goals_r.scalar_one_or_none()

    result = compute_fit_score(
        user_skills=list(profile.skills or []) if profile else [],
        user_frameworks=list(profile.frameworks or []) if profile else [],
        user_languages=list(profile.languages or []) if profile else [],
        user_experience_years=profile.experience_years if profile else None,
        user_preferred_locations=list(profile.preferred_locations or []) if profile else [],
        user_work_mode=profile.work_mode if profile else None,
        user_current_salary=profile.current_salary if profile else None,
        user_target_role=goal.target_role if goal else None,
        user_target_salary_min=goal.target_salary_min if goal else None,
        job_title=payload.job_title,
        job_description=payload.job_description,
        job_requirements=payload.job_requirements,
        job_experience_required=payload.job_experience_required,
        job_location=payload.job_location,
        job_work_mode=payload.job_work_mode,
        job_salary_min=payload.job_salary_min,
        job_salary_max=payload.job_salary_max,
    )
    return result


# ─── Serialisers ─────────────────────────────────────────────────────────────

def _skill_to_dict(s: CareerSkill) -> dict:
    return {
        "id": str(s.id),
        "skill_name": s.skill_name,
        "category": s.category,
        "level": s.level,
        "verified": s.verified,
        "last_used_year": s.last_used_year,
        "trending_score": s.trending_score,
        "years_experience": s.years_experience,
    }


def _goal_to_dict(g: CareerGoal) -> dict:
    return {
        "id": str(g.id),
        "target_role": g.target_role,
        "target_company": g.target_company,
        "target_salary_min": g.target_salary_min,
        "target_salary_max": g.target_salary_max,
        "target_location": g.target_location,
        "timeline_months": g.timeline_months,
        "work_mode": g.work_mode,
        "is_active": g.is_active,
    }


def _milestone_to_dict(m: CareerMilestone) -> dict:
    return {
        "id": str(m.id),
        "type": m.type,
        "title": m.title,
        "company": m.company,
        "milestone_date": m.milestone_date,
        "impact_statement": m.impact_statement,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }
