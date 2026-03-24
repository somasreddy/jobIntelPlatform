from fastapi import APIRouter, Body, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from interview_coach.service import InterviewCoachService

router = APIRouter()
_service = InterviewCoachService()


@router.post("/questions")
async def get_tailored_questions(payload: Dict[str, Any] = Body(...)):
    """
    Generate personalized interview questions based on candidate profile and target job.
    Payload: { profile: {...}, target_role: "...", target_company: "..." }
    """
    profile = payload.get("profile")
    target_role = payload.get("target_role")
    target_company = payload.get("target_company", "")
    job_description = payload.get("job_description", "")

    if not profile or not target_role:
        raise HTTPException(status_code=400, detail="Profile and target_role are required")

    result = await _service.generate_questions(profile, target_role, target_company, job_description)
    return result


class MockInterviewRequest(BaseModel):
    profile: Dict[str, Any]
    target_role: str
    target_company: Optional[str] = ""
    conversation_history: Optional[List[Dict[str, str]]] = []


@router.post("/mock-chat")
async def mock_interview_chat(payload: MockInterviewRequest):
    """
    Conduct a live mock interview turn-by-turn.

    Send conversation_history as a list of {role: "user"|"assistant", content: str}.
    The LLM interviewer gives feedback on the last answer and asks the next question.

    Returns: { feedback, next_question, question_type, difficulty, is_complete }
    """
    if not payload.profile or not payload.target_role:
        raise HTTPException(status_code=400, detail="profile and target_role are required")

    result = await _service.conduct_mock_interview(
        profile=payload.profile,
        target_role=payload.target_role,
        target_company=payload.target_company or "",
        conversation_history=payload.conversation_history or [],
    )
    return result
