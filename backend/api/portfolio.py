"""
Portfolio Builder API
Build a public career portfolio with projects, skills, AI-generated bio.
"""
import uuid
import re
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.auth import get_current_user_id
from core.llm import smart_chat
from models.database import Portfolio, PortfolioProject, CandidateProfile

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class PortfolioUpsert(BaseModel):
    headline: Optional[str] = None
    bio: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    website_url: Optional[str] = None
    theme: str = "dark"
    is_public: bool = False
    skills: List[str] = []
    certifications: List[str] = []


class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    tech_stack: List[str] = []
    demo_url: Optional[str] = None
    github_url: Optional[str] = None
    featured: bool = False


# ─── Portfolio CRUD ───────────────────────────────────────────────────────────

def _make_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:80] or "user"


async def _get_or_create_portfolio(user_id: uuid.UUID, db: AsyncSession) -> Portfolio:
    result = await db.execute(
        select(Portfolio).where(Portfolio.user_id == user_id)
    )
    portfolio = result.scalar_one_or_none()
    if portfolio is None:
        # Get name from profile for slug
        profile_r = await db.execute(
            select(CandidateProfile).where(CandidateProfile.user_id == user_id)
        )
        profile = profile_r.scalar_one_or_none()
        base_slug = _make_slug(profile.name if profile else str(user_id)[:8])

        # Ensure unique slug
        slug = base_slug
        suffix = 1
        while True:
            exists_r = await db.execute(select(Portfolio).where(Portfolio.slug == slug))
            if not exists_r.scalar_one_or_none():
                break
            slug = f"{base_slug}-{suffix}"
            suffix += 1

        portfolio = Portfolio(user_id=user_id, slug=slug)
        db.add(portfolio)
        await db.flush()
    return portfolio


@router.get("/")
async def get_portfolio(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await _get_or_create_portfolio(user_id, db)
    projects_r = await db.execute(
        select(PortfolioProject)
        .where(PortfolioProject.portfolio_id == portfolio.id)
        .order_by(PortfolioProject.sort_order, PortfolioProject.created_at.desc())
    )
    return {**_portfolio_to_dict(portfolio), "projects": [_project_to_dict(p) for p in projects_r.scalars().all()]}


@router.put("/")
async def upsert_portfolio(
    payload: PortfolioUpsert,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await _get_or_create_portfolio(user_id, db)
    portfolio.headline = payload.headline
    portfolio.bio = payload.bio
    portfolio.linkedin_url = payload.linkedin_url
    portfolio.github_url = payload.github_url
    portfolio.website_url = payload.website_url
    portfolio.theme = payload.theme
    portfolio.is_public = payload.is_public
    portfolio.skills = payload.skills
    portfolio.certifications = payload.certifications
    return _portfolio_to_dict(portfolio)


@router.post("/generate-bio")
async def generate_bio(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """AI-generate a professional portfolio bio from the candidate profile."""
    profile_r = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    profile = profile_r.scalar_one_or_none()
    if not profile:
        raise HTTPException(400, "Set up your profile first")

    portfolio = await _get_or_create_portfolio(user_id, db)
    projects_r = await db.execute(
        select(PortfolioProject).where(PortfolioProject.portfolio_id == portfolio.id)
    )
    projects = projects_r.scalars().all()

    prompt = f"""You are a personal branding expert. Write a compelling 3-4 sentence portfolio bio for:
- Name: {profile.name}
- Role: {profile.current_role or "Professional"}
- Experience: {profile.experience_years or 0} years
- Skills: {', '.join((profile.skills or [])[:8])}
- Frameworks: {', '.join((profile.frameworks or [])[:5])}
- Projects: {', '.join([p.title for p in projects[:3]])}

Write in first person. Be specific, confident, and human — no clichés.
Return ONLY valid JSON: {{"bio": "the bio text"}}"""

    try:
        data = await smart_chat(system="Return ONLY valid JSON.", user=prompt, json_mode=True)
        if isinstance(data, dict) and data.get("bio"):
            portfolio.ai_bio = data["bio"]
            return {"bio": data["bio"]}
    except Exception as e:
        logger.warning(f"Bio generation failed: {e}")

    return {"error": "Bio generation unavailable"}


# ─── Projects ────────────────────────────────────────────────────────────────

@router.post("/projects")
async def add_project(
    payload: ProjectCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await _get_or_create_portfolio(user_id, db)
    project = PortfolioProject(
        portfolio_id=portfolio.id,
        user_id=user_id,
        title=payload.title,
        description=payload.description,
        tech_stack=payload.tech_stack,
        demo_url=payload.demo_url,
        github_url=payload.github_url,
        featured=payload.featured,
    )
    db.add(project)
    await db.flush()

    # AI impact rewrite
    if payload.description:
        prompt = f"""Rewrite this project description as a powerful 2-sentence impact statement for a portfolio.
Start with a strong verb. Include measurable impact where possible.
Project: {payload.title}
Description: {payload.description}
Tech: {', '.join(payload.tech_stack[:5])}
Return ONLY valid JSON: {{"impact": "rewritten statement"}}"""
        try:
            data = await smart_chat(system="Return ONLY valid JSON.", user=prompt, json_mode=True)
            if isinstance(data, dict):
                project.ai_impact = data.get("impact")
        except Exception:
            pass

    return _project_to_dict(project)


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PortfolioProject).where(
            PortfolioProject.id == project_id,
            PortfolioProject.user_id == user_id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")
    await db.delete(project)
    return {"deleted": str(project_id)}


# ─── Public Portfolio ─────────────────────────────────────────────────────────

@router.get("/public/{slug}")
async def get_public_portfolio(slug: str, db: AsyncSession = Depends(get_db)):
    """Public-facing portfolio — no auth required."""
    result = await db.execute(
        select(Portfolio).where(Portfolio.slug == slug, Portfolio.is_public == True)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(404, "Portfolio not found or not public")

    # Increment view count
    portfolio.view_count += 1

    projects_r = await db.execute(
        select(PortfolioProject)
        .where(PortfolioProject.portfolio_id == portfolio.id)
        .order_by(PortfolioProject.featured.desc(), PortfolioProject.sort_order)
    )
    return {**_portfolio_to_dict(portfolio), "projects": [_project_to_dict(p) for p in projects_r.scalars().all()]}


# ─── Serialisers ─────────────────────────────────────────────────────────────

def _portfolio_to_dict(p: Portfolio) -> dict:
    return {
        "id": str(p.id),
        "slug": p.slug,
        "headline": p.headline,
        "bio": p.ai_bio or p.bio,
        "linkedin_url": p.linkedin_url,
        "github_url": p.github_url,
        "website_url": p.website_url,
        "theme": p.theme,
        "is_public": p.is_public,
        "view_count": p.view_count,
        "skills": p.skills or [],
        "certifications": p.certifications or [],
        "public_url": f"/portfolio/{p.slug}",
    }


def _project_to_dict(p: PortfolioProject) -> dict:
    return {
        "id": str(p.id),
        "title": p.title,
        "description": p.description,
        "ai_impact": p.ai_impact,
        "tech_stack": p.tech_stack or [],
        "demo_url": p.demo_url,
        "github_url": p.github_url,
        "featured": p.featured,
        "sort_order": p.sort_order,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }
