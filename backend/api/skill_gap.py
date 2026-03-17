from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from skill_gap_engine.analyzer import SkillGapAnalyzer

router = APIRouter()
_analyzer = SkillGapAnalyzer()


@router.post("/analyze")
async def analyze_skill_gap(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze skill gaps for a candidate profile.
    Body: { profile_skills: [...], target_role: "Senior QA" }
    """
    profile_skills = payload.get("profile_skills", [])
    target_role = payload.get("target_role", "QA Automation Engineer")
    result = await _analyzer.analyze(profile_skills, target_role, db_session=db)
    return result


@router.get("/")
async def get_skill_gaps_legacy(
    profile_id: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Legacy GET endpoint — runs analysis with empty profile for market overview."""
    result = await _analyzer.analyze([], "QA Automation Engineer", db_session=db)
    return result
