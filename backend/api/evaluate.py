"""
Evaluate router — career-ops ports:
  POST /api/evaluate/compare   (2G) — Compare 2-3 offers side-by-side
  POST /api/evaluate/course    (2F) — Is this course/cert worth taking?
  POST /api/evaluate/project   (2F) — Should I feature this project?
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

# ── Shared helpers ────────────────────────────────────────────────────────────
def _safe_json(raw: str) -> dict | list:
    import re
    text = raw.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
    try:
        return json.loads(text.strip())
    except Exception:
        for start, end in [('{', '}'), ('[', ']')]:
            idx = text.find(start)
            if idx != -1:
                try:
                    return json.loads(text[idx:])
                except Exception:
                    pass
    return {}


# ── 2G: Offer Comparison (career-ops ofertas.md) ─────────────────────────────
_COMPARE_SYSTEM = """You are a senior career strategist who has helped 10,000+ professionals evaluate job offers.
Given 2-3 job offers and a candidate profile, produce a structured comparison using the career-ops 6-block scoring framework.

For EACH offer score A-F blocks (1.0-5.0):
  A. Role summary & archetype fit
  B. CV/skills match (specific gaps and strengths)
  C. Level/growth strategy
  D. Compensation vs market
  E. Personalization effort required (lower = better)
  F. Interview difficulty estimate

Then provide a weighted recommendation.

Return ONLY valid JSON:
{
  "offers": [
    {
      "offer_id": "...",
      "company": "...",
      "role": "...",
      "scores": { "A": 4.5, "B": 3.8, "C": 4.2, "D": 3.5, "E": 4.0, "F": 3.0 },
      "global_score": 3.83,
      "strengths": ["..."],
      "risks": ["..."],
      "salary_verdict": "Below market by 15%"
    }
  ],
  "recommendation": { "offer_id": "...", "reason": "..." },
  "comparison_matrix": { "best_comp": "...", "best_growth": "...", "easiest_to_land": "..." },
  "key_tradeoffs": ["...", "..."]
}"""


@router.post("/compare")
async def compare_offers(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """
    Compare 2-3 job offers using the career-ops 6-block scoring framework.

    Body:
      {
        "profile": { ...candidate profile... },
        "offers": [
          { "offer_id": "uuid-or-label", "job_description": "...", "company": "...",
            "role": "...", "salary": "..." },
          ...
        ]
      }

    OR supply job_ids from the database:
      { "profile": {...}, "job_ids": ["uuid1", "uuid2"] }
    """
    profile = payload.get("profile", {})
    offers  = payload.get("offers", [])

    # Load jobs from DB if job_ids supplied
    job_ids = payload.get("job_ids", [])
    if job_ids and not offers:
        uids = []
        for jid in job_ids[:3]:
            try:
                uids.append(uuid.UUID(jid))
            except ValueError:
                pass
        if uids:
            rows = (await db.execute(select(VerifiedJob).where(VerifiedJob.id.in_(uids)))).scalars().all()
            offers = [
                {
                    "offer_id": str(r.id),
                    "company":  r.organization,
                    "role":     r.title,
                    "job_description": r.description or "",
                    "salary": f"{r.currency or 'USD'} {r.salary_min or '?'}-{r.salary_max or '?'}",
                }
                for r in rows
            ]

    if len(offers) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 offers to compare")
    if len(offers) > 3:
        offers = offers[:3]

    user_msg = (
        f"Candidate profile:\n{json.dumps(profile, indent=2)}\n\n"
        + "\n\n".join(
            f"OFFER {i+1} ({o.get('company','?')} — {o.get('role','?')}):\n"
            f"Salary: {o.get('salary','not provided')}\n"
            f"Description: {(o.get('job_description') or '')[:2000]}"
            for i, o in enumerate(offers)
        )
    )

    raw = await smart_chat(_COMPARE_SYSTEM, user_msg, max_tokens=3000, temperature=0.3, task_type="evaluation")
    result = _safe_json(raw)

    if not result:
        result = {
            "offers": [{"offer_id": o.get("offer_id", str(i)), "company": o.get("company"), "role": o.get("role")} for i, o in enumerate(offers)],
            "recommendation": {"offer_id": offers[0].get("offer_id", "0"), "reason": "Unable to generate comparison — check LLM connectivity"},
            "raw_analysis": raw[:2000],
        }

    return result


# ── 2F: Course / Certification Evaluator (career-ops training.md) ─────────────
_COURSE_SYSTEM = """You are a senior learning strategist and career coach specializing in tech career transitions.
Evaluate whether a course/certification is worth a candidate's time and money.

Analyse:
1. Market demand for this skill/cert (high/medium/low)
2. Time investment vs career ROI
3. Alternatives (free vs paid)
4. How it maps to the candidate's target roles
5. Prerequisites the candidate might be missing

Return ONLY valid JSON:
{
  "verdict": "STRONG YES | YES | NEUTRAL | NO",
  "roi_score": 4.2,
  "market_demand": "High",
  "time_to_complete": "20-30 hours",
  "estimated_salary_bump_pct": 8,
  "maps_to_archetypes": ["AI Platform Engineer", "ML Engineer"],
  "strengths": ["..."],
  "weaknesses": ["..."],
  "free_alternatives": [{"name": "...", "url": "..."}],
  "recommended_after": ["list skills/certs to do first"],
  "action": "Specific next step recommendation"
}"""


@router.post("/course")
async def evaluate_course(payload: dict = Body(...)):
    """
    Evaluate whether a course or certification is worth taking.

    Body:
      {
        "profile": { ...candidate profile... },
        "course": {
          "name": "...",
          "provider": "Coursera | Udemy | ...",
          "description": "...",
          "url": "...",
          "cost_usd": 49,
          "duration_hours": 30
        }
      }
    """
    profile = payload.get("profile", {})
    course  = payload.get("course", {})
    if not course.get("name"):
        raise HTTPException(status_code=400, detail="course.name is required")

    user_msg = (
        f"Candidate:\n"
        f"Role: {profile.get('current_role','?')} | Experience: {profile.get('experience_years','?')} years\n"
        f"Skills: {', '.join((profile.get('skills') or [])[:15])}\n"
        f"Target roles: {profile.get('target_roles', 'not specified')}\n\n"
        f"Course/Cert:\n"
        f"Name: {course.get('name')}\n"
        f"Provider: {course.get('provider','unknown')}\n"
        f"Cost: USD {course.get('cost_usd','unknown')}\n"
        f"Duration: {course.get('duration_hours','unknown')} hours\n"
        f"Description: {(course.get('description') or '')[:1500]}"
    )

    raw    = await smart_chat(_COURSE_SYSTEM, user_msg, max_tokens=1500, temperature=0.3, task_type="evaluation")
    result = _safe_json(raw)

    if not result:
        result = {
            "verdict": "NEUTRAL",
            "action": "Unable to evaluate — check LLM connectivity",
            "raw_analysis": raw[:1000],
        }

    return {**result, "course": course}


# ── 2F: Portfolio Project Evaluator (career-ops project.md) ───────────────────
_PROJECT_SYSTEM = """You are a senior engineering hiring manager and technical career coach.
Evaluate a candidate's portfolio project and advise how to best leverage it in a job search.

Analyse:
1. Which roles/archetypes this project signals for
2. Technical depth and differentiation
3. How to frame it in CV bullets (PAR format)
4. What to add to make it more impressive
5. Red flags or gaps to address

Return ONLY valid JSON:
{
  "showcase_score": 4.1,
  "best_for_roles": ["AI Platform Engineer", "Backend Engineer"],
  "worst_for_roles": ["Mobile Engineer"],
  "cv_bullets": ["Engineered ... reducing ... by X%", "..."],
  "linkedin_headline_hook": "Short compelling hook for LinkedIn",
  "improvements": [
    { "what": "Add unit tests", "impact": "High", "effort": "Medium" }
  ],
  "talking_points": ["...", "..."],
  "red_flags": ["...", "..."],
  "verdict": "FEATURE PROMINENTLY | INCLUDE WITH CONTEXT | OMIT"
}"""


@router.post("/project")
async def evaluate_project(payload: dict = Body(...)):
    """
    Evaluate a portfolio project for job search suitability.

    Body:
      {
        "profile": { ...candidate profile... },
        "project": {
          "name": "...",
          "description": "...",
          "tech_stack": ["Python", "FastAPI"],
          "github_url": "...",
          "live_url": "...",
          "duration_months": 3,
          "team_size": 1
        }
      }
    """
    profile = payload.get("profile", {})
    project = payload.get("project", {})
    if not project.get("name"):
        raise HTTPException(status_code=400, detail="project.name is required")

    user_msg = (
        f"Candidate:\n"
        f"Role: {profile.get('current_role','?')} | Experience: {profile.get('experience_years','?')} years\n"
        f"Target roles: {profile.get('target_roles','not specified')}\n\n"
        f"Project:\n"
        f"Name: {project.get('name')}\n"
        f"Tech stack: {', '.join(project.get('tech_stack') or [])}\n"
        f"Duration: {project.get('duration_months','?')} months | Team: {project.get('team_size',1)} people\n"
        f"Description: {(project.get('description') or '')[:2000]}\n"
        f"GitHub: {project.get('github_url','not provided')}"
    )

    raw    = await smart_chat(_PROJECT_SYSTEM, user_msg, max_tokens=1500, temperature=0.3, task_type="evaluation")
    result = _safe_json(raw)

    if not result:
        result = {
            "verdict": "INCLUDE WITH CONTEXT",
            "showcase_score": 3.0,
            "raw_analysis": raw[:1000],
        }

    return {**result, "project": project}
