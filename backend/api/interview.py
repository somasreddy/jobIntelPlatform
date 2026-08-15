import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Body, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from interview_coach.service import InterviewCoachService
from interview_coach.spaced_repetition import (
    apply_grade, next_review_at, is_due, BOX_INTERVALS_DAYS,
)
from core.database import get_db
from core.auth import get_current_user_id
from models.database import MasterStory, QuestionReviewState

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


# ── Shadow Interview Review (STAR rubric debrief) ─────────────────────────────
class ShadowReviewRequest(BaseModel):
    role: str = Field(..., min_length=1)
    company: Optional[str] = ""
    interview_notes: str = Field(..., min_length=1)
    outcome: Optional[str] = None   # "offer" | "rejected" | "pending"


@router.post("/shadow-review")
async def shadow_review(
    payload: ShadowReviewRequest,
    _: uuid.UUID = Depends(get_current_user_id),
):
    """
    AI post-interview debrief for real interview notes the candidate already
    submitted to (i.e. a real interview that already happened) — an overall
    grade/coaching breakdown PLUS an explicit STAR-structure rubric
    (Situation/Task/Action/Result each scored 0-100 with a one-line
    justification grounded in the actual notes, not generic advice).

    Lives here (not backend/api/interview_analytics.py, which has an older
    shadow-review endpoint using the same request shape) because this
    module's scope owns the Interview Prep + Shadow Review deepening work;
    the analytics module's endpoint is left untouched.
    """
    return await _service.review_shadow_interview(
        role=payload.role,
        company=payload.company or "",
        interview_notes=payload.interview_notes,
        outcome=payload.outcome or "",
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


# ── Spaced Repetition — "Due for Review" queue ────────────────────────────────
# Real, deterministic Leitner-style leveled interval scheduler (see
# interview_coach/spaced_repetition.py) — NOT an LLM call, and not tied to any
# one question source. Any question_id (static bank id, "gen_N" profile id, or
# an id from an LLM-generated JD-specific set) can be graded; `question_snapshot`
# is cached at first grade so the queue can render it later regardless of source.

class ReviewGradeRequest(BaseModel):
    question_id: str = Field(..., min_length=1)
    grade: str = Field(..., description="'weak' (resurface sooner) or 'strong' (push further out)")
    question_domain: Optional[str] = None
    question_type: Optional[str] = None
    question_snapshot: Optional[Dict[str, Any]] = None


def _review_state_to_dict(s: QuestionReviewState) -> dict:
    box = s.box if 0 <= s.box < len(BOX_INTERVALS_DAYS) else 0
    return {
        "question_id": s.question_id,
        "domain": s.question_domain,
        "type": s.question_type,
        "box": s.box,
        "interval_days": BOX_INTERVALS_DAYS[box],
        "repetitions": s.repetitions,
        "correct_streak": s.correct_streak,
        "last_grade": s.last_grade,
        "last_reviewed_at": s.last_reviewed_at.isoformat() if s.last_reviewed_at else None,
        "next_review_at": s.next_review_at.isoformat() if s.next_review_at else None,
        "is_due": is_due(s.next_review_at) if s.next_review_at else True,
        "question_snapshot": s.question_snapshot or {},
    }


@router.get("/review/state")
async def list_review_state(
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """All per-question spaced-repetition state tracked for the current user
    (used by the client to badge already-tracked questions with their next
    review date, regardless of whether they're due yet)."""
    result = await db.execute(
        select(QuestionReviewState).where(QuestionReviewState.user_id == uid)
    )
    return [_review_state_to_dict(s) for s in result.scalars().all()]


@router.get("/review/queue")
async def get_review_queue(
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Questions due for review right now (next_review_at <= now), earliest first."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(QuestionReviewState)
        .where(QuestionReviewState.user_id == uid, QuestionReviewState.next_review_at <= now)
        .order_by(QuestionReviewState.next_review_at.asc())
    )
    due = result.scalars().all()

    total_result = await db.execute(
        select(func.count()).select_from(QuestionReviewState).where(QuestionReviewState.user_id == uid)
    )
    total_tracked = total_result.scalar_one()

    return {
        "due": [_review_state_to_dict(s) for s in due],
        "due_count": len(due),
        "total_tracked": total_tracked,
    }


@router.post("/review/grade")
async def grade_review(
    payload: ReviewGradeRequest,
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """
    Record a self-graded recall for a question and reschedule it with the
    Leitner-style leveled interval scheduler: 'strong' promotes the question
    to the next box (pushes it further out); 'weak' drops it back to box 0
    (resurfaces tomorrow) so shaky questions get repeated practice sooner.
    """
    grade = payload.grade.strip().lower()
    if grade not in ("weak", "strong"):
        raise HTTPException(status_code=400, detail="grade must be 'weak' or 'strong'")

    result = await db.execute(
        select(QuestionReviewState).where(
            QuestionReviewState.user_id == uid,
            QuestionReviewState.question_id == payload.question_id,
        )
    )
    state = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    current_box = state.box if state else 0
    new_box, interval_days = apply_grade(current_box, grade)  # type: ignore[arg-type]
    scheduled_for = next_review_at(interval_days, now)

    if state is None:
        state = QuestionReviewState(
            user_id=uid,
            question_id=payload.question_id,
            question_domain=payload.question_domain,
            question_type=payload.question_type,
            question_snapshot=payload.question_snapshot or {},
            box=new_box,
            repetitions=1,
            correct_streak=1 if grade == "strong" else 0,
            last_grade=grade,
            last_reviewed_at=now,
            next_review_at=scheduled_for,
        )
        db.add(state)
    else:
        state.box = new_box
        state.repetitions += 1
        state.correct_streak = state.correct_streak + 1 if grade == "strong" else 0
        state.last_grade = grade
        state.last_reviewed_at = now
        state.next_review_at = scheduled_for
        if payload.question_domain:
            state.question_domain = payload.question_domain
        if payload.question_type:
            state.question_type = payload.question_type
        if payload.question_snapshot:
            state.question_snapshot = payload.question_snapshot

    await db.flush()
    await db.refresh(state)
    return _review_state_to_dict(state)


@router.delete("/review/state/{question_id}")
async def reset_review_state(
    question_id: str,
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Stop tracking a question in the spaced-repetition queue (reset progress)."""
    result = await db.execute(
        select(QuestionReviewState).where(
            QuestionReviewState.user_id == uid,
            QuestionReviewState.question_id == question_id,
        )
    )
    state = result.scalar_one_or_none()
    if not state:
        raise HTTPException(status_code=404, detail="No review state tracked for this question")
    await db.delete(state)
    return {"deleted": question_id}
