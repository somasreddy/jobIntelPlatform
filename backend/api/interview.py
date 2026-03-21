from fastapi import APIRouter, Body, HTTPException
from typing import Dict, Any
from interview_coach.service import InterviewCoachService

router = APIRouter()
_service = InterviewCoachService()

@router.post("/questions")
async def get_tailored_questions(
    payload: Dict[str, Any] = Body(...)
):
    """
    Generate personalized interview questions based on candidate profile and target job.
    Payload: { profile: {...}, target_role: "...", target_company: "..." }
    """
    profile = payload.get("profile")
    target_role = payload.get("target_role")
    target_company = payload.get("target_company", "")

    if not profile or not target_role:
        raise HTTPException(status_code=400, detail="Profile and target_role are required")

    result = await _service.generate_questions(profile, target_role, target_company)
    return result
