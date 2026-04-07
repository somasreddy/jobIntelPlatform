"""
Apply router — career-ops apply.md port (2D).
POST /api/apply/generate-answers — generate tailored answers for job application forms.
"""
import uuid
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.auth import get_current_user_id
from core.llm import smart_chat
from models.database import Application, VerifiedJob

logger = logging.getLogger(__name__)
router = APIRouter()

_APPLY_SYSTEM = """You are an expert job application coach who has helped 50,000+ candidates land roles at top companies.
Given a candidate profile, a job description context, and a list of application form questions, generate tailored, honest, compelling answers.

Rules:
- Answer each question individually and specifically — no generic fluff
- Mirror the company's language and values from the job description
- Keep answers within the specified character limit (if provided)
- Use PAR (Problem-Action-Result) or STAR format for behavioural questions
- For "Why us?" questions, reference specific company initiatives, products, or values
- Never fabricate metrics — use ranges ("~40%", "3-5x") where exact numbers aren't available
- Be authentic and specific to the candidate's actual experience

Return ONLY valid JSON:
{
  "answers": [
    {
      "question": "original question text",
      "answer": "your tailored answer",
      "character_count": 320,
      "tone": "Professional | Enthusiastic | Technical",
      "key_phrases_used": ["company value mirrored", "..."]
    }
  ],
  "application_tips": ["...", "..."],
  "red_flag_questions": ["questions to be careful about"]
}"""


@router.post("/generate-answers")
async def generate_form_answers(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """
    Generate tailored answers for job application form questions.

    Body:
      {
        "profile": { ...candidate profile... },
        "job_id": "uuid",               # optional — load context from DB
        "job_context": {                # or provide directly
          "company": "Anthropic",
          "role": "Senior AI Engineer",
          "description": "...",
          "values": ["safety", "research", "impact"]
        },
        "questions": [
          { "question": "Why do you want to work here?", "char_limit": 500 },
          { "question": "Describe a time you led a cross-functional project.", "char_limit": 800 },
          { "question": "What's your greatest professional achievement?" }
        ],
        "evaluation_report": { ... }   # optional — pull context from prior 6-block eval
      }
    """
    profile     = payload.get("profile", {})
    questions   = payload.get("questions", [])
    job_context = payload.get("job_context", {})
    eval_report = payload.get("evaluation_report", {})

    if not questions:
        raise HTTPException(status_code=400, detail="questions list is required")
    if len(questions) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 questions per request")

    # Load job context from DB if job_id provided
    job_id = payload.get("job_id")
    if job_id and not job_context:
        try:
            job_uid = uuid.UUID(job_id)
            row = (
                await db.execute(select(VerifiedJob).where(VerifiedJob.id == job_uid))
            ).scalar_one_or_none()
            if row:
                job_context = {
                    "company":     row.organization,
                    "role":        row.title,
                    "description": (row.description or "")[:3000],
                    "technologies": row.technologies or [],
                }
        except ValueError:
            pass

    # Build structured question list with char limits
    q_text = "\n".join(
        f"{i+1}. {q.get('question','?')}"
        + (f" [max {q['char_limit']} chars]" if q.get("char_limit") else "")
        for i, q in enumerate(questions)
    )

    user_msg = (
        f"CANDIDATE:\n"
        f"Name: {profile.get('name','Candidate')}\n"
        f"Role: {profile.get('current_role','?')} | "
        f"Experience: {profile.get('experience_years','?')} years\n"
        f"Skills: {', '.join((profile.get('skills') or [])[:12])}\n"
        f"Frameworks: {', '.join((profile.get('frameworks') or [])[:8])}\n"
        + (f"Target role: {profile.get('target_role','')}\n" if profile.get('target_role') else "")
        + "\n"
        f"COMPANY / JOB CONTEXT:\n"
        f"Company: {job_context.get('company','unknown')}\n"
        f"Role: {job_context.get('role','unknown')}\n"
        f"Job description excerpt: {(job_context.get('description') or '')[:2000]}\n"
        + (f"Company values: {', '.join(job_context.get('values',[]))}\n" if job_context.get('values') else "")
        + "\n"
        + (
            f"PRIOR EVALUATION CONTEXT:\n"
            f"Block B — CV match notes: {eval_report.get('block_b','')}\n"
            f"Block E — Personalization notes: {eval_report.get('block_e','')}\n\n"
            if eval_report else ""
        )
        + f"FORM QUESTIONS TO ANSWER:\n{q_text}"
    )

    raw    = await smart_chat(_APPLY_SYSTEM, user_msg, max_tokens=4000, temperature=0.4, task_type="application")
    result = {}

    # Parse JSON
    import re
    text = raw.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
    try:
        result = json.loads(text.strip())
    except Exception:
        idx = text.find('{')
        if idx != -1:
            try:
                result = json.loads(text[idx:])
            except Exception:
                pass

    if not result or not result.get("answers"):
        # Structured fallback — one answer per question
        result = {
            "answers": [
                {
                    "question": q.get("question", ""),
                    "answer": f"[LLM unavailable — please review the job description and personalise this answer for {job_context.get('company','this company')}]",
                    "character_count": 0,
                    "tone": "Professional",
                }
                for q in questions
            ],
            "application_tips": [
                "Ensure each answer mirrors the job description language",
                "Keep answers specific with quantified achievements where possible",
            ],
        }

    # Enforce character limits (trim if over)
    for i, ans in enumerate(result.get("answers", [])):
        if i < len(questions):
            limit = questions[i].get("char_limit")
            if limit and len(ans.get("answer", "")) > limit:
                ans["answer"] = ans["answer"][:limit - 3] + "..."
                ans["trimmed"] = True
        ans["character_count"] = len(ans.get("answer", ""))

    return result


@router.post("/voice-note-script")
async def generate_voice_note_script(payload: dict = Body(...)):
    """
    Generate a 30-second LinkedIn voice note script for recruiter outreach.
    Port of career-ops contacto.md voice note section.

    Body:
      {
        "profile": { ...candidate profile... },
        "recruiter_name": "Sarah",
        "company": "Anthropic",
        "role": "Senior AI Engineer"
      }
    """
    profile        = payload.get("profile", {})
    recruiter_name = payload.get("recruiter_name", "there")
    company        = payload.get("company", "your company")
    role           = payload.get("role", "this role")

    system = (
        "You are a career coach specializing in LinkedIn outreach. "
        "Write a natural, warm, 30-second voice note script (~80 words) for a candidate reaching out to a recruiter. "
        "It should: introduce the candidate briefly, mention 1 specific impressive achievement, "
        "reference the role + company, and end with a clear CTA. "
        "Return ONLY the script text — no JSON, no labels."
    )
    user_msg = (
        f"Recruiter: {recruiter_name} at {company}\n"
        f"Role: {role}\n"
        f"My name: {profile.get('name','the candidate')}\n"
        f"My role: {profile.get('current_role','Software Engineer')}\n"
        f"My experience: {profile.get('experience_years','5')} years\n"
        f"Top skills: {', '.join((profile.get('skills') or [])[:5])}\n"
        f"Best achievement: {profile.get('top_achievement','led platform migration reducing costs by 35%')}"
    )

    script = await smart_chat(system, user_msg, max_tokens=200, temperature=0.6, task_type="outreach")
    return {
        "script":          script.strip(),
        "word_count":      len(script.split()),
        "estimated_seconds": len(script.split()) * 0.4,
    }
