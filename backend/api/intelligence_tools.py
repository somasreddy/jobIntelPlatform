"""
Intelligence Tools API — 8 Power Tools for Job Search
POST endpoints, each backed by multi-LLM consolidated smart_chat().
"""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from services.intelligence_tools import (
    run_hiring_decoder,
    run_resume_surgeon,
    run_linkedin_infiltrator,
    run_interview_trap_detector,
    run_cold_email_weapon,
    run_offer_negotiator,
    run_gap_killer,
    run_attack_plan,
)

router = APIRouter()


# ─── Request models ───────────────────────────────────────────────────────────

class HiringDecoderRequest(BaseModel):
    job_description: str = Field(..., min_length=50, description="Full job description text")


class ResumeSurgeonRequest(BaseModel):
    job_description: str = Field(..., min_length=50, description="Full job description text")
    resume_text: str = Field(..., min_length=50, description="Candidate's current resume as plain text")


class LinkedInInfiltratorRequest(BaseModel):
    job_description: str = Field(..., min_length=50, description="Full job description text")
    current_headline: str = Field(default="", description="Candidate's current LinkedIn headline")
    current_about: str = Field(default="", description="Candidate's current LinkedIn About section")


class InterviewTrapRequest(BaseModel):
    job_description: str = Field(..., min_length=50, description="Full job description text")
    resume_text: str = Field(..., min_length=50, description="Candidate's resume / background")
    company: str = Field(..., min_length=1, description="Target company name")
    role: str = Field(..., min_length=1, description="Target role title")


class ColdEmailRequest(BaseModel):
    company: str = Field(..., min_length=1, description="Target company name")
    role: str = Field(..., min_length=1, description="Target role title")
    background_summary: str = Field(..., min_length=30, description="3-5 sentence summary of candidate's background")


class OfferNegotiatorRequest(BaseModel):
    offer_details: str = Field(..., min_length=20, description="Full offer details — salary, equity, benefits, role")
    role: str = Field(..., min_length=1, description="Role title")
    company: str = Field(..., min_length=1, description="Company name")
    current_salary: str = Field(default="", description="Candidate's current or expected salary")


class GapKillerRequest(BaseModel):
    gap_description: str = Field(..., min_length=30, description="Honest description of the gap situation")
    gap_type: str = Field(..., description="layoff | career_change | sabbatical | health_break | family | other")
    target_role: str = Field(..., min_length=1, description="Target role the candidate is applying for")


class AttackPlanRequest(BaseModel):
    target_role: str = Field(..., min_length=1, description="Target role title")
    resume_text: str = Field(..., min_length=50, description="Candidate's resume or background summary")
    location: str = Field(default="Remote", description="Preferred location or 'Remote'")


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/hiring-decoder")
async def hiring_decoder(req: HiringDecoderRequest):
    """Decode what the hiring manager REALLY wants from a job description."""
    return await run_hiring_decoder(req.job_description)


@router.post("/resume-surgeon")
async def resume_surgeon(req: ResumeSurgeonRequest):
    """Completely rewrite the resume tailored to this exact role and JD."""
    return await run_resume_surgeon(req.job_description, req.resume_text)


@router.post("/linkedin-infiltrator")
async def linkedin_infiltrator(req: LinkedInInfiltratorRequest):
    """Optimize LinkedIn profile to appear in recruiter searches for this role."""
    return await run_linkedin_infiltrator(
        req.job_description, req.current_headline, req.current_about
    )


@router.post("/interview-trap-detector")
async def interview_trap_detector(req: InterviewTrapRequest):
    """Generate 10 likely interview questions with trap detection and strong answers."""
    return await run_interview_trap_detector(
        req.job_description, req.resume_text, req.company, req.role
    )


@router.post("/cold-email-weapon")
async def cold_email_weapon(req: ColdEmailRequest):
    """Generate cold email, LinkedIn note, voice note script, and follow-up sequence."""
    return await run_cold_email_weapon(req.company, req.role, req.background_summary)


@router.post("/offer-negotiator")
async def offer_negotiator(req: OfferNegotiatorRequest):
    """Generate word-for-word negotiation scripts, counter-offer, and alt levers."""
    return await run_offer_negotiator(
        req.offer_details, req.role, req.company, req.current_salary
    )


@router.post("/gap-killer")
async def gap_killer(req: GapKillerRequest):
    """Generate employment gap explanations for cover letter, interview, and LinkedIn."""
    return await run_gap_killer(req.gap_description, req.gap_type, req.target_role)


@router.post("/attack-plan")
async def attack_plan(req: AttackPlanRequest):
    """Generate a hyper-specific 48-hour job search action plan."""
    return await run_attack_plan(req.target_role, req.resume_text, req.location)
