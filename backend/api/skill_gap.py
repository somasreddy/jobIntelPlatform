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


@router.post("/career-score")
async def get_career_score(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Compute a holistic Career Readiness Score.
    Payload: { profile_skills: [...], target_role: "..." }
    """
    profile_skills = payload.get("profile_skills", [])
    target_role = payload.get("target_role", "QA Automation Engineer")
    
    analysis = await _analyzer.analyze(profile_skills, target_role, db_session=db)
    
    # Simple scoring logic: 
    # (Number of high-demand skills present / total high-demand skills) * 100
    strengths = analysis.get("strengths", [])
    missing = analysis.get("missing_high_demand_skills", [])
    
    total_relevant = len(strengths) + len(missing)
    if total_relevant == 0:
        score = 70
    else:
        score = int((len(strengths) / total_relevant) * 100)
    
    return {
        "score": score,
        "factors": {
            "strengths_count": len(strengths),
            "missing_count": len(missing),
            "market_demand_match": score
        },
        "recommendation": "Focus on Phase 1 of the roadmap to bridge critical gaps." if score < 70 else "You are well-positioned for this role."
    }
