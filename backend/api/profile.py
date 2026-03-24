import uuid
import logging
import io
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from core.database import get_db
from models.database import CandidateProfile

logger = logging.getLogger(__name__)
router = APIRouter()

_DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class ProfileUpsert(BaseModel):
    name: str
    current_role: Optional[str] = None
    current_salary: Optional[int] = None
    currency: Optional[str] = "USD"
    experience_years: Optional[int] = None
    current_location: Optional[str] = None
    preferred_locations: Optional[List[str]] = []
    skills: Optional[List[str]] = []
    frameworks: Optional[List[str]] = []
    languages: Optional[List[str]] = []
    cicd_tools: Optional[List[str]] = []
    ai_tools: Optional[List[str]] = []
    certifications: Optional[List[str]] = []
    work_mode: Optional[str] = None
    base_resume_text: Optional[str] = None


def _profile_to_dict(p: CandidateProfile) -> dict:
    return {
        "id": str(p.id),
        "name": p.name,
        "current_role": p.current_role,
        "current_salary": p.current_salary,
        "currency": p.currency,
        "experience_years": p.experience_years,
        "current_location": p.current_location,
        "preferred_locations": p.preferred_locations or [],
        "skills": p.skills or [],
        "frameworks": p.frameworks or [],
        "languages": p.languages or [],
        "cicd_tools": p.cicd_tools or [],
        "ai_tools": p.ai_tools or [],
        "certifications": p.certifications or [],
        "work_mode": p.work_mode,
        "base_resume_text": p.base_resume_text,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("/")
async def get_profile(db: AsyncSession = Depends(get_db)):
    """Get the current user's profile from the database."""
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == _DEMO_USER_ID)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Use PUT to create one.")
    return _profile_to_dict(profile)


@router.put("/")
async def upsert_profile(payload: ProfileUpsert, db: AsyncSession = Depends(get_db)):
    """Create or update the current user's profile in the database."""
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == _DEMO_USER_ID)
    )
    profile = result.scalar_one_or_none()

    data = payload.model_dump(exclude_none=False)

    if profile:
        for field, value in data.items():
            setattr(profile, field, value)
    else:
        profile = CandidateProfile(user_id=_DEMO_USER_ID, **data)
        db.add(profile)

    await db.flush()
    await db.refresh(profile)
    return _profile_to_dict(profile)


_PARSE_SYSTEM = """You are an expert resume parser. Extract structured profile data from the resume text.
Return ONLY a valid JSON object with these exact keys (use empty string/array/0 for missing fields):
{
  "name": "Full Name",
  "current_role": "Most recent job title",
  "experience_years": 5,
  "current_location": "City, Country",
  "skills": ["skill1", "skill2"],
  "frameworks": ["framework1"],
  "languages": ["Python", "JavaScript"],
  "cicd_tools": ["Jenkins", "GitHub Actions"],
  "ai_tools": ["ChatGPT", "LangChain", "Copilot"],
  "certifications": ["AWS Certified Solutions Architect"],
  "work_mode": "Remote|Hybrid|On-site|Any"
}
Rules:
- skills: general technical/domain skills and tools (NOT programming languages or frameworks)
- frameworks: React, Spring Boot, FastAPI, Django, LangChain, webMethods, MuleSoft, etc.
- languages: programming/scripting languages only (Python, Java, TypeScript, SQL, Bash, etc.)
- cicd_tools: CI/CD + DevOps + infra tools (Jenkins, GitHub Actions, Docker, Kubernetes, Terraform, etc.)
- ai_tools: any AI tools — as user (ChatGPT, Copilot, Midjourney, Cursor) AND as developer (OpenAI API, LangChain, RAG, Hugging Face)
- work_mode: infer from resume context — "Remote", "Hybrid", "On-site", or "Any"
- experience_years: total years of relevant professional experience (integer)"""


class ResumeParseRequest(BaseModel):
    resume_text: str


@router.post("/parse-resume")
async def parse_resume_endpoint(payload: ResumeParseRequest):
    """Parse resume text using LLM and return extracted profile fields."""
    if not payload.resume_text or len(payload.resume_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Resume text too short to parse")

    import json as _json
    def _lst(v): return v if isinstance(v, list) else []
    def _make(d: dict) -> dict:
        return {
            "name": str(d.get("name", "") or ""),
            "current_role": str(d.get("current_role", "") or ""),
            "experience_years": int(d.get("experience_years") or 0),
            "current_location": str(d.get("current_location", "") or ""),
            "skills": _lst(d.get("skills")),
            "frameworks": _lst(d.get("frameworks")),
            "languages": _lst(d.get("languages")),
            "cicd_tools": _lst(d.get("cicd_tools")),
            "ai_tools": _lst(d.get("ai_tools")),
            "certifications": _lst(d.get("certifications")),
            "work_mode": str(d.get("work_mode", "Any") or "Any"),
        }

    user_prompt = f"Extract profile data from this resume:\n\n{payload.resume_text[:6000]}"
    try:
        from core.llm import smart_chat
        raw = await smart_chat(
            _PARSE_SYSTEM, user_prompt,
            max_tokens=1500, temperature=0.1,
            task_type="resume_parse", cache_ttl=0,
        )
        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        return _make(_json.loads(clean.strip()))
    except Exception as e:
        logger.warning(f"Resume parse LLM failed: {e}")
        return _make({})


def _extract_text_from_file(filename: str, content: bytes) -> str:
    """Extract plain text from PDF, DOCX, or TXT bytes. Tries pdfplumber first, falls back to PyPDF2."""
    name = filename.lower()
    if name.endswith(".pdf"):
        # Try pdfplumber first (better quality)
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                text = "\n".join(p.extract_text() or "" for p in pdf.pages)
            if text.strip():
                return text
        except ImportError:
            pass
        except Exception as e:
            logger.warning(f"pdfplumber failed for {filename}: {e}")
        # Fallback to PyPDF2
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as e:
            logger.warning(f"PyPDF2 failed for {filename}: {e}")
    elif name.endswith(".docx") or name.endswith(".doc"):
        try:
            from docx import Document
            doc = Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception as e:
            logger.warning(f"python-docx failed for {filename}: {e}")
    elif name.endswith(".txt"):
        return content.decode("utf-8", errors="ignore")
    return ""


@router.post("/parse-resume-file")
async def parse_resume_file(file: UploadFile = File(...)):
    """Upload a PDF/DOCX/TXT resume, extract text, parse with LLM, return profile fields."""
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    text = _extract_text_from_file(file.filename or "", content)
    if not text or len(text.strip()) < 50:
        raise HTTPException(status_code=422, detail="Could not extract text from file. Please paste your resume text manually.")

    import json as _json

    def _lst(v): return v if isinstance(v, list) else []
    def _build_response(data: dict) -> dict:
        return {
            "name": str(data.get("name", "") or ""),
            "current_role": str(data.get("current_role", "") or ""),
            "experience_years": int(data.get("experience_years") or 0),
            "current_location": str(data.get("current_location", "") or ""),
            "skills": _lst(data.get("skills")),
            "frameworks": _lst(data.get("frameworks")),
            "languages": _lst(data.get("languages")),
            "cicd_tools": _lst(data.get("cicd_tools")),
            "ai_tools": _lst(data.get("ai_tools")),
            "certifications": _lst(data.get("certifications")),
            "work_mode": str(data.get("work_mode", "Any") or "Any"),
            "resume_text": text[:8000],
        }

    user_prompt = f"Extract profile data from this resume:\n\n{text[:6000]}"
    try:
        from core.llm import smart_chat
        raw = await smart_chat(
            _PARSE_SYSTEM, user_prompt,
            max_tokens=1500, temperature=0.1,
            task_type="resume_parse", cache_ttl=0,
        )
        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        data = _json.loads(clean.strip())
        return _build_response(data)
    except _json.JSONDecodeError as e:
        logger.warning(f"Resume parse JSON decode failed: {e}")
        # Return at minimum the extracted text so the profile still gets the resume
        return _build_response({})
    except Exception as e:
        logger.warning(f"Resume file parse LLM failed: {e}")
        # Still return the extracted resume_text even if LLM fails
        return _build_response({})


@router.delete("/")
async def delete_profile(db: AsyncSession = Depends(get_db)):
    """Delete the current user's profile."""
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == _DEMO_USER_ID)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    await db.delete(profile)
    return {"deleted": True}
