"""
Company Intelligence API
CRUD + AI enrichment for company profiles and crowdsourced interview reports.
"""
import uuid
import logging
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from core.database import get_db
from core.auth import get_current_user_id
from core.llm import smart_chat
from models.database import Company, CompanyInterviewReport

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class InterviewReportCreate(BaseModel):
    role: str
    interview_rounds: Optional[int] = None
    difficulty: Optional[int] = None          # 1-5
    outcome: Optional[str] = None             # Offer | Rejected | Withdrew | Pending
    questions: List[str] = []
    process_description: Optional[str] = None
    tips: Optional[str] = None


# ─── Company lookup ──────────────────────────────────────────────────────────

@router.get("/search")
async def search_companies(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db),
):
    """Fuzzy search companies by name."""
    result = await db.execute(
        select(Company)
        .where(Company.name.ilike(f"%{q}%"))
        .order_by(Company.name)
        .limit(20)
    )
    return [_company_brief(c) for c in result.scalars().all()]


@router.get("/{company_id}")
async def get_company(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Full company profile with interview reports."""
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(404, "Company not found")

    reports_r = await db.execute(
        select(CompanyInterviewReport)
        .where(CompanyInterviewReport.company_id == company_id)
        .order_by(CompanyInterviewReport.created_at.desc())
        .limit(20)
    )
    reports = reports_r.scalars().all()

    return {**_company_full(company), "interview_reports": [_report_to_dict(r) for r in reports]}


@router.post("/enrich")
async def enrich_company(
    company_name: str,
    domain: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: uuid.UUID = Depends(get_current_user_id),
):
    """
    Get or create a company record and enrich it with AI-generated intelligence.
    Idempotent — safe to call multiple times.
    """
    # Check existing
    query = select(Company).where(Company.name.ilike(company_name))
    if domain:
        query = select(Company).where(Company.domain == domain)
    result = await db.execute(query)
    company = result.scalar_one_or_none()

    if company is None:
        company = Company(name=company_name, domain=domain)
        db.add(company)
        await db.flush()

    # AI enrichment if insider_report is missing
    if not company.insider_report:
        prompt = f"""You are a company intelligence analyst. Write a concise insider brief about {company_name}.
Cover: culture, interview style, growth trajectory, tech stack, red flags if any.
Return ONLY valid JSON:
{{
  "description": "2-3 sentence company overview",
  "culture_signals": ["signal 1", "signal 2", "signal 3"],
  "interview_style": "description of typical interview process",
  "tech_stack": ["tech1", "tech2", "tech3"],
  "green_flags": ["positive 1", "positive 2"],
  "red_flags": ["concern 1"],
  "insider_report": "3-4 sentence insider summary for a candidate"
}}"""
        try:
            ai_data = await smart_chat(
                system="Return ONLY valid JSON. No markdown.",
                user=prompt,
                json_mode=True,
            )
            if isinstance(ai_data, dict):
                company.description = ai_data.get("description", company.description)
                company.tech_stack = ai_data.get("tech_stack", [])
                company.insider_report = ai_data.get("insider_report", "")
                company.interview_process = {
                    "style": ai_data.get("interview_style", ""),
                    "green_flags": ai_data.get("green_flags", []),
                    "red_flags": ai_data.get("red_flags", []),
                    "culture_signals": ai_data.get("culture_signals", []),
                }
                company.last_updated = datetime.now(timezone.utc)
        except Exception as e:
            logger.warning(f"Company enrichment AI call failed: {e}")

    return _company_full(company)


# ─── Interview Reports ────────────────────────────────────────────────────────

@router.post("/{company_id}/interview-reports")
async def submit_interview_report(
    company_id: uuid.UUID,
    payload: InterviewReportCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Company).where(Company.id == company_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Company not found")

    report = CompanyInterviewReport(
        company_id=company_id,
        submitted_by=user_id,
        role=payload.role,
        interview_rounds=payload.interview_rounds,
        difficulty=payload.difficulty,
        outcome=payload.outcome,
        questions=payload.questions,
        process_description=payload.process_description,
        tips=payload.tips,
    )
    db.add(report)
    await db.flush()

    # Update company difficulty average
    avg_r = await db.execute(
        select(func.avg(CompanyInterviewReport.difficulty))
        .where(CompanyInterviewReport.company_id == company_id)
    )
    avg_diff = avg_r.scalar_one_or_none()
    if avg_diff:
        result2 = await db.execute(select(Company).where(Company.id == company_id))
        company = result2.scalar_one_or_none()
        if company:
            company.interview_difficulty_avg = round(avg_diff, 2)

    return _report_to_dict(report)


# ─── Serialisers ─────────────────────────────────────────────────────────────

def _company_brief(c: Company) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "domain": c.domain,
        "industry": c.industry,
        "size_range": c.size_range,
        "hq_location": c.hq_location,
        "glassdoor_rating": c.glassdoor_rating,
        "funding_stage": c.funding_stage,
        "growth_score": c.growth_score,
    }


def _company_full(c: Company) -> dict:
    return {
        "id": str(c.id),
        "name": c.name,
        "domain": c.domain,
        "industry": c.industry,
        "size_range": c.size_range,
        "founded_year": c.founded_year,
        "hq_location": c.hq_location,
        "remote_policy": c.remote_policy,
        "description": c.description,
        "website": c.website,
        "linkedin_url": c.linkedin_url,
        "funding_stage": c.funding_stage,
        "last_funding_amount": c.last_funding_amount,
        "glassdoor_rating": c.glassdoor_rating,
        "glassdoor_review_count": c.glassdoor_review_count,
        "culture_score": c.culture_score,
        "growth_score": c.growth_score,
        "layoff_risk_score": c.layoff_risk_score,
        "interview_difficulty_avg": c.interview_difficulty_avg,
        "tech_stack": c.tech_stack or [],
        "salary_ranges": c.salary_ranges or {},
        "interview_process": c.interview_process or {},
        "insider_report": c.insider_report,
        "last_updated": c.last_updated.isoformat() if c.last_updated else None,
    }


def _report_to_dict(r: CompanyInterviewReport) -> dict:
    return {
        "id": str(r.id),
        "role": r.role,
        "interview_rounds": r.interview_rounds,
        "difficulty": r.difficulty,
        "outcome": r.outcome,
        "questions": r.questions or [],
        "process_description": r.process_description,
        "tips": r.tips,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
