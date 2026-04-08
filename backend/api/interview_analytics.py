"""
Interview Analytics & Shadow Review API
Real-time STAR analysis, quality scoring, and shadow interview review.
"""
import uuid
import logging
import re
from typing import Optional, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.auth import get_current_user_id
from core.llm import smart_chat

logger = logging.getLogger(__name__)
router = APIRouter()

# ─── Schemas ─────────────────────────────────────────────────────────────────

class AnswerAnalysisRequest(BaseModel):
    question: str
    answer: str
    job_title: Optional[str] = None
    expected_type: Optional[str] = None   # behavioral | technical | situational


class ShadowReviewRequest(BaseModel):
    role: str
    company: str
    interview_notes: str             # candidate's raw notes from a real interview
    outcome: Optional[str] = None   # "offer" | "rejected" | "pending"


class MockFeedbackRequest(BaseModel):
    question: str
    answer: str
    job_title: str
    interview_type: str = "behavioral"  # behavioral | technical | case | leadership | stress


# ─── Answer Quality Analyzer ─────────────────────────────────────────────────

_FILLER_WORDS = {
    "um", "uh", "like", "you know", "basically", "literally", "actually",
    "sort of", "kind of", "i mean", "so", "right", "okay", "well",
}

def _count_fillers(text: str) -> int:
    words = text.lower().split()
    return sum(1 for w in words if w in _FILLER_WORDS)

def _star_completeness(text: str) -> dict:
    text_lower = text.lower()
    markers = {
        "situation": any(w in text_lower for w in ["when", "at", "during", "worked at", "was at", "situation", "context"]),
        "task": any(w in text_lower for w in ["my role", "responsible", "tasked", "needed to", "had to", "task"]),
        "action": any(w in text_lower for w in ["i did", "i built", "i implemented", "i led", "i created", "i designed", "i worked", "action"]),
        "result": any(w in text_lower for w in ["result", "outcome", "achieved", "reduced", "increased", "%", "saved", "improved", "led to"]),
    }
    return markers

def _specificity_score(text: str) -> int:
    """Simple heuristic — numbers and proper nouns signal specificity."""
    has_numbers = len(re.findall(r"\d+", text)) >= 2
    has_pct = "%" in text
    has_dollar = "$" in text or "k" in text.lower()
    word_count = len(text.split())
    length_score = min(100, word_count * 2)   # up to 50 words
    specificity = (has_numbers * 20 + has_pct * 15 + has_dollar * 10 + length_score) / 145 * 100
    return min(100, int(specificity))


@router.post("/analyze-answer")
async def analyze_answer(
    payload: AnswerAnalysisRequest,
    _: uuid.UUID = Depends(get_current_user_id),
):
    """
    Real-time analysis of a single interview answer.
    Returns STAR completeness, specificity, filler word count, and quality score.
    """
    star = _star_completeness(payload.answer)
    star_score = int(sum(star.values()) / 4 * 100)
    specificity = _specificity_score(payload.answer)
    filler_count = _count_fillers(payload.answer)
    word_count = len(payload.answer.split())
    filler_pct = round(filler_count / max(word_count, 1) * 100, 1)

    # Penalty for fillers
    filler_penalty = min(30, filler_count * 3)
    quality_score = max(0, int((star_score * 0.5 + specificity * 0.5) - filler_penalty))

    missing_parts = [k for k, v in star.items() if not v]
    suggestions = []
    if not star["result"]:
        suggestions.append("Add a quantified result — mention %, $, or time saved")
    if not star["action"]:
        suggestions.append("Be more specific about what YOU did vs. the team")
    if filler_count > 5:
        suggestions.append(f"Reduce filler words ({filler_count} detected) — pause instead of saying 'um/like'")
    if word_count < 100:
        suggestions.append("Expand your answer — aim for 150-250 words")
    elif word_count > 400:
        suggestions.append("Tighten the answer — 150-250 words is the sweet spot")

    return {
        "quality_score": quality_score,
        "star_completeness": {
            "score": star_score,
            "breakdown": star,
            "missing": missing_parts,
        },
        "specificity_score": specificity,
        "filler_words": {
            "count": filler_count,
            "percentage": filler_pct,
            "severity": "high" if filler_pct > 10 else "medium" if filler_pct > 5 else "low",
        },
        "word_count": word_count,
        "suggestions": suggestions,
    }


# ─── Mock Interview Feedback ──────────────────────────────────────────────────

@router.post("/mock-feedback")
async def mock_feedback(
    payload: MockFeedbackRequest,
    _: uuid.UUID = Depends(get_current_user_id),
):
    """
    AI-powered feedback on a mock interview answer.
    Returns a rewritten version, grade, and coaching notes.
    """
    prompt = f"""You are an expert interview coach for {payload.job_title} roles.
The candidate answered this {payload.interview_type} interview question:

Q: {payload.question}

A: {payload.answer}

Evaluate and coach them. Return ONLY valid JSON:
{{
  "grade": "A/B/C/D/F",
  "score": 82,
  "what_worked": ["specific strength 1", "strength 2"],
  "what_to_fix": ["specific issue 1", "issue 2"],
  "rewritten_answer": "A stronger version of their answer (150-250 words)",
  "coaching_note": "One key coaching insight in 1-2 sentences"
}}"""

    try:
        data = await smart_chat(
            system="Return ONLY valid JSON. Be honest but constructive.",
            user=prompt,
            json_mode=True,
        )
        if isinstance(data, dict):
            return data
    except Exception as e:
        logger.warning(f"Mock feedback AI call failed: {e}")

    return {"error": "Feedback temporarily unavailable"}


# ─── Shadow Interview Review ──────────────────────────────────────────────────

@router.post("/shadow-review")
async def shadow_review(
    payload: ShadowReviewRequest,
    _: uuid.UUID = Depends(get_current_user_id),
):
    """
    Review real interview notes and provide post-interview coaching.
    What went well, what to fix, missed opportunities, and suggested rewrites.
    """
    outcome_context = f"Outcome: {payload.outcome}." if payload.outcome else "Outcome unknown."

    prompt = f"""You are a world-class interview coach reviewing a candidate's real interview notes.

Role: {payload.role} at {payload.company}
{outcome_context}

Candidate's interview notes:
{payload.interview_notes}

Provide a detailed post-interview debrief. Return ONLY valid JSON:
{{
  "overall_grade": "B+",
  "overall_score": 75,
  "what_went_well": ["specific thing 1", "thing 2", "thing 3"],
  "missed_opportunities": [
    {{
      "moment": "what happened",
      "what_you_could_have_said": "stronger response",
      "why_it_matters": "impact on hiring decision"
    }}
  ],
  "red_flag_moments": ["moment that likely hurt your candidacy"],
  "suggested_rewrites": [
    {{
      "original": "what they said",
      "rewrite": "stronger version"
    }}
  ],
  "likelihood_of_offer": "High / Medium / Low",
  "if_rejected_why": "Most likely reason if rejected",
  "follow_up_strategy": "What to send in your follow-up email",
  "lessons_for_next_time": ["lesson 1", "lesson 2", "lesson 3"]
}}"""

    try:
        data = await smart_chat(
            system="Return ONLY valid JSON. Be candid — the candidate needs honest coaching.",
            user=prompt,
            json_mode=True,
        )
        if isinstance(data, dict):
            data["role"] = payload.role
            data["company"] = payload.company
            return data
    except Exception as e:
        logger.warning(f"Shadow review AI call failed: {e}")

    return {"error": "Review temporarily unavailable"}
