import uuid
import logging
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Body, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from interview_coach.service import InterviewCoachService
from core.database import get_db
from core.auth import get_current_user_id
from models.database import MasterStory

logger = logging.getLogger(__name__)
router = APIRouter()
_service = InterviewCoachService()


# ── Interview Question Generation ─────────────────────────────────────────────
@router.post("/questions")
async def get_tailored_questions(payload: Dict[str, Any] = Body(...)):
    """
    Generate personalized interview questions based on candidate profile and target job.
    Payload: { profile: {...}, target_role: "...", target_company: "...", job_description: "..." }
    """
    profile = payload.get("profile")
    target_role = payload.get("target_role")
    if not profile or not target_role:
        raise HTTPException(status_code=400, detail="profile and target_role are required")

    return await _service.generate_questions(
        profile, target_role,
        payload.get("target_company", ""),
        payload.get("job_description", ""),
    )


# ── Mock Interview (turn-by-turn) ─────────────────────────────────────────────
class MockInterviewRequest(BaseModel):
    profile: Dict[str, Any]
    target_role: str
    target_company: Optional[str] = ""
    conversation_history: Optional[List[Dict[str, str]]] = []


@router.post("/mock-chat")
async def mock_interview_chat(payload: MockInterviewRequest):
    """
    Live mock interview turn-by-turn.
    Send conversation_history as [{role: user|assistant, content: str}].
    Returns: { feedback, next_question, question_type, difficulty, score, is_complete }
    """
    if not payload.profile or not payload.target_role:
        raise HTTPException(status_code=400, detail="profile and target_role are required")

    return await _service.conduct_mock_interview(
        profile=payload.profile,
        target_role=payload.target_role,
        target_company=payload.target_company or "",
        conversation_history=payload.conversation_history or [],
    )


# ── STAR+R Story Bank ─────────────────────────────────────────────────────────
class StoryCreate(BaseModel):
    requirement: str   = Field(..., min_length=3,  description="JD requirement this story addresses")
    story_theme: str   = Field(..., min_length=5,  description="Theme or hook")
    situation:   Optional[str] = None
    task:        Optional[str] = None
    action:      Optional[str] = None
    result:      Optional[str] = None
    reflection:  Optional[str] = None
    archetype_tags: Optional[List[str]] = []
    source_job:  Optional[str] = None


def _story_to_dict(s: MasterStory) -> dict:
    return {
        "id":           str(s.id),
        "requirement":  s.requirement,
        "story_theme":  s.story_theme,
        "situation":    s.situation,
        "task":         s.task,
        "action":       s.action,
        "result":       s.result,
        "reflection":   s.reflection,
        "archetype_tags": s.archetype_tags or [],
        "source_job":   s.source_job,
        "created_at":   str(s.created_at)[:10] if s.created_at else None,
    }


@router.get("/stories")
async def list_stories(
    archetype: Optional[str] = Query(None, description="Filter by archetype tag"),
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """List all STAR+R master stories for the current user, optionally filtered by archetype."""
    stmt = (
        select(MasterStory)
        .where(MasterStory.user_id == uid)
        .order_by(MasterStory.created_at.desc())
    )
    result = await db.execute(stmt)
    stories = result.scalars().all()
    if archetype:
        stories = [s for s in stories if archetype.lower() in [t.lower() for t in (s.archetype_tags or [])]]
    return [_story_to_dict(s) for s in stories]


@router.post("/stories", status_code=201)
async def add_story(
    payload: StoryCreate,
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Add a new STAR+R story to the master story bank."""
    story = MasterStory(
        user_id=uid,
        requirement=payload.requirement,
        story_theme=payload.story_theme,
        situation=payload.situation,
        task=payload.task,
        action=payload.action,
        result=payload.result,
        reflection=payload.reflection,
        archetype_tags=payload.archetype_tags or [],
        source_job=payload.source_job,
    )
    db.add(story)
    await db.flush()
    await db.refresh(story)
    return _story_to_dict(story)


@router.patch("/stories/{story_id}")
async def update_story(
    story_id: str,
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Update an existing STAR+R story."""
    try:
        sid = uuid.UUID(story_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid story ID")

    result = await db.execute(
        select(MasterStory).where(MasterStory.id == sid, MasterStory.user_id == uid)
    )
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    for field in ("requirement", "story_theme", "situation", "task", "action", "result", "reflection", "source_job", "archetype_tags"):
        if field in payload:
            setattr(story, field, payload[field])

    await db.flush()
    return _story_to_dict(story)


@router.delete("/stories/{story_id}")
async def delete_story(
    story_id: str,
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Delete a story from the bank."""
    try:
        sid = uuid.UUID(story_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid story ID")

    result = await db.execute(
        select(MasterStory).where(MasterStory.id == sid, MasterStory.user_id == uid)
    )
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    await db.delete(story)
    return {"deleted": str(sid)}
