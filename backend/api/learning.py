"""
Learning Engine API
Skill-gap → learning path → resource catalogue → completion tracking.
"""
import uuid
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from core.auth import get_current_user_id
from core.llm import smart_chat
from models.database import LearningPath, LearningResource, LearningCompletion, CandidateProfile, CareerSkill
from services.skill_job_bridge import on_skill_completed

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class GeneratePathRequest(BaseModel):
    skill_name: str
    current_level: int = 0    # 0=none, 1-5
    target_level: int = 3


class CompleteResourceRequest(BaseModel):
    path_id: Optional[uuid.UUID] = None
    resource_id: Optional[uuid.UUID] = None
    resource_url: Optional[str] = None
    skill_name: str
    rating_given: Optional[int] = None   # 1-5
    notes: Optional[str] = None


def _fallback_learning_resources(skill_name: str, current_level: int = 0, target_level: int = 3) -> list[dict]:
    skill = (skill_name or "Skill").strip() or "Skill"
    key = skill.lower()

    curated: list[dict] = []
    if "playwright" in key:
        curated = [
            {"title": "Playwright Getting Started", "provider": "Playwright", "url": "https://playwright.dev/docs/intro", "type": "article", "duration_minutes": 45, "difficulty": "Beginner", "is_free": True, "description": "Install Playwright, run first tests, and understand the test runner."},
            {"title": "Writing Playwright Tests", "provider": "Playwright", "url": "https://playwright.dev/docs/writing-tests", "type": "article", "duration_minutes": 75, "difficulty": "Beginner", "is_free": True, "description": "Learn locators, assertions, fixtures, and resilient UI test structure."},
            {"title": "Playwright API Testing", "provider": "Playwright", "url": "https://playwright.dev/docs/api-testing", "type": "article", "duration_minutes": 90, "difficulty": "Intermediate", "is_free": True, "description": "Use Playwright request contexts for API tests and setup flows."},
            {"title": "Trace Viewer and Debugging", "provider": "Playwright", "url": "https://playwright.dev/docs/trace-viewer", "type": "article", "duration_minutes": 60, "difficulty": "Intermediate", "is_free": True, "description": "Debug flaky tests with traces, screenshots, network, and action timeline."},
            {"title": "Playwright Best Practices", "provider": "Playwright", "url": "https://playwright.dev/docs/best-practices", "type": "article", "duration_minutes": 60, "difficulty": "Advanced", "is_free": True, "description": "Enterprise patterns for reliable selectors, isolation, and maintainable suites."},
        ]
    elif "selenium" in key:
        curated = [
            {"title": "Selenium WebDriver Documentation", "provider": "Selenium", "url": "https://www.selenium.dev/documentation/webdriver/", "type": "article", "duration_minutes": 90, "difficulty": "Beginner", "is_free": True, "description": "Core WebDriver concepts, browser automation, waits, and element interactions."},
            {"title": "Selenium Test Practices", "provider": "Selenium", "url": "https://www.selenium.dev/documentation/test_practices/", "type": "article", "duration_minutes": 90, "difficulty": "Intermediate", "is_free": True, "description": "Recommended practices for maintainable and reliable Selenium automation."},
            {"title": "Selenium Grid", "provider": "Selenium", "url": "https://www.selenium.dev/documentation/grid/", "type": "article", "duration_minutes": 120, "difficulty": "Advanced", "is_free": True, "description": "Scale browser tests across environments with Selenium Grid."},
        ]
    elif "api" in key and "test" in key:
        curated = [
            {"title": "Postman API Testing Learning Path", "provider": "Postman", "url": "https://learning.postman.com/docs/writing-scripts/test-scripts/", "type": "article", "duration_minutes": 90, "difficulty": "Beginner", "is_free": True, "description": "Write assertions, validate responses, and organize API test collections."},
            {"title": "REST Assured Usage Guide", "provider": "REST Assured", "url": "https://github.com/rest-assured/rest-assured/wiki/Usage", "type": "article", "duration_minutes": 120, "difficulty": "Intermediate", "is_free": True, "description": "Java-based API testing patterns with request specs, assertions, and auth."},
            {"title": "OWASP API Security Top 10", "provider": "OWASP", "url": "https://owasp.org/API-Security/", "type": "article", "duration_minutes": 120, "difficulty": "Advanced", "is_free": True, "description": "Security-focused API risks every senior QA engineer should test for."},
        ]

    if not curated:
        query = skill.replace(" ", "+")
        curated = [
            {"title": f"{skill} official documentation", "provider": "Official docs search", "url": f"https://www.google.com/search?q={query}+official+documentation", "type": "article", "duration_minutes": 60, "difficulty": "Beginner", "is_free": True, "description": f"Start with the official documentation and setup guide for {skill}."},
            {"title": f"{skill} full course", "provider": "YouTube", "url": f"https://www.youtube.com/results?search_query={query}+full+course", "type": "video", "duration_minutes": 180, "difficulty": "Beginner", "is_free": True, "description": f"Find a recent end-to-end course and complete one practical walkthrough for {skill}."},
            {"title": f"Build a {skill} portfolio project", "provider": "Portfolio project", "url": f"https://www.google.com/search?q={query}+project+tutorial", "type": "project", "duration_minutes": 240, "difficulty": "Intermediate", "is_free": True, "description": f"Create a small proof-of-skill project and add notes/screenshots to your portfolio."},
            {"title": f"Advanced {skill} best practices", "provider": "Best-practice search", "url": f"https://www.google.com/search?q={query}+best+practices", "type": "article", "duration_minutes": 90, "difficulty": "Advanced", "is_free": True, "description": f"Study production patterns, pitfalls, and senior-level practices for {skill}."},
        ]

    if current_level >= 3:
        curated = [r for r in curated if r.get("difficulty") != "Beginner"] + [r for r in curated if r.get("difficulty") == "Beginner"]
    return curated[:6]


def _estimated_hours(resources: list[dict], default: int = 20) -> int:
    minutes = sum(int(r.get("duration_minutes") or 0) for r in resources)
    return max(default, round(minutes / 60)) if minutes else default


# ─── Learning Paths ──────────────────────────────────────────────────────────

@router.get("/paths")
async def list_paths(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LearningPath)
        .where(LearningPath.user_id == user_id)
        .order_by(LearningPath.updated_at.desc())
    )
    paths = result.scalars().all()
    return [_path_to_dict(p) for p in paths]


@router.post("/paths/generate")
async def generate_learning_path(
    payload: GeneratePathRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    AI-generate a structured learning path for the given skill gap.
    Returns (and persists) the path with resource list.
    """
    # Check if path already exists
    existing_r = await db.execute(
        select(LearningPath).where(
            LearningPath.user_id == user_id,
            LearningPath.skill_name.ilike(payload.skill_name),
            LearningPath.status == "active",
        )
    )
    existing = existing_r.scalar_one_or_none()
    if existing:
        if not existing.resources:
            fallback_resources = _fallback_learning_resources(payload.skill_name, payload.current_level, payload.target_level)
            existing.resources = fallback_resources
            existing.estimated_hours = _estimated_hours(fallback_resources)
            existing.current_level = payload.current_level
            existing.target_level = payload.target_level
            await db.flush()
        return _path_to_dict(existing)

    # AI-generated learning path
    prompt = f"""You are a learning path architect. Create a structured learning path for someone who wants to reach level {payload.target_level}/5 in "{payload.skill_name}" from level {payload.current_level}/5.
Return ONLY valid JSON:
{{
  "estimated_hours": 40,
  "resources": [
    {{
      "title": "Resource title",
      "provider": "Coursera",
      "url": "https://...",
      "type": "course",
      "duration_minutes": 120,
      "difficulty": "Beginner",
      "is_free": true,
      "description": "Why this resource"
    }}
  ]
}}
Include 5-8 resources ordered from beginner to advanced. Use real, reputable providers (Coursera, Udemy, YouTube, official docs, freeCodeCamp, etc.)."""

    resources_data = []
    estimated_hours = 20

    try:
        ai_data = await smart_chat(
            system="Return ONLY valid JSON. No markdown fences.",
            user=prompt,
            json_mode=True,
        )
        if isinstance(ai_data, dict):
            estimated_hours = ai_data.get("estimated_hours", 20)
            resources_data = ai_data.get("resources", [])
    except Exception as e:
        logger.warning(f"Learning path AI generation failed: {e}")

    # Augment with real resources from aggregator
    try:
        from services.learning_aggregator import aggregate_resources
        real_resources = await aggregate_resources(payload.skill_name, max_total=6)
        # Merge: add real resources that aren't already in AI results (by URL)
        existing_urls = {r.get("url", "") for r in resources_data}
        for rr in real_resources:
            if rr.get("url") and rr["url"] not in existing_urls:
                resources_data.append(rr)
                existing_urls.add(rr["url"])
    except Exception as e:
        logger.warning(f"Learning aggregator failed (non-critical): {e}")

    fallback_resources = _fallback_learning_resources(payload.skill_name, payload.current_level, payload.target_level)
    existing_urls = {r.get("url", "") for r in resources_data}
    for resource in fallback_resources:
        if resource.get("url") and resource["url"] not in existing_urls:
            resources_data.append(resource)
            existing_urls.add(resource["url"])
    resources_data = resources_data[:8]
    if resources_data:
        estimated_hours = _estimated_hours(resources_data, estimated_hours)

    # Persist the path
    path = LearningPath(
        user_id=user_id,
        skill_name=payload.skill_name,
        current_level=payload.current_level,
        target_level=payload.target_level,
        estimated_hours=estimated_hours,
        status="active",
        progress_pct=0,
        resources=resources_data,
    )
    db.add(path)
    await db.flush()

    # Save resources to catalogue
    for r in resources_data:
        url = r.get("url", "")
        if not url:
            continue
        existing_res_r = await db.execute(
            select(LearningResource).where(LearningResource.url == url)
        )
        if not existing_res_r.scalar_one_or_none():
            res = LearningResource(
                skill_name=payload.skill_name,
                title=r.get("title", "Untitled"),
                provider=r.get("provider"),
                url=url,
                type=r.get("type", "course"),
                duration_minutes=r.get("duration_minutes"),
                difficulty=r.get("difficulty"),
                is_free=r.get("is_free", False),
                tags=[payload.skill_name],
            )
            db.add(res)

    return _path_to_dict(path)


@router.delete("/paths/{path_id}")
async def delete_path(
    path_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LearningPath).where(LearningPath.id == path_id, LearningPath.user_id == user_id)
    )
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(404, "Path not found")
    await db.delete(path)
    return {"deleted": str(path_id)}


# ─── Resources ───────────────────────────────────────────────────────────────

@router.get("/resources")
async def search_resources(
    skill: str = Query(..., min_length=2),
    live: bool = Query(False),    # fetch live resources from aggregator
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LearningResource)
        .where(LearningResource.skill_name.ilike(f"%{skill}%"))
        .order_by(LearningResource.rating.desc().nullslast())
        .limit(30)
    )
    db_resources = [_resource_to_dict(r) for r in result.scalars().all()]

    if live:
        try:
            from services.learning_aggregator import aggregate_resources
            live_resources = await aggregate_resources(skill, max_total=8)
            existing_urls = {r.get("url") for r in db_resources}
            for lr in live_resources:
                if lr.get("url") not in existing_urls:
                    db_resources.append(lr)
        except Exception as e:
            logger.warning(f"Live resource fetch failed: {e}")

    return db_resources


# ─── Completions ─────────────────────────────────────────────────────────────

@router.get("/completions")
async def list_completions(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LearningCompletion)
        .where(LearningCompletion.user_id == user_id)
        .order_by(LearningCompletion.completed_at.desc())
    )
    return [_completion_to_dict(c) for c in result.scalars().all()]


@router.post("/completions")
async def mark_complete(
    payload: CompleteResourceRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    completion = LearningCompletion(
        user_id=user_id,
        path_id=payload.path_id,
        resource_id=payload.resource_id,
        resource_url=payload.resource_url,
        skill_name=payload.skill_name,
        rating_given=payload.rating_given,
        notes=payload.notes,
    )
    db.add(completion)

    # Update path progress
    if payload.path_id:
        path_r = await db.execute(
            select(LearningPath).where(
                LearningPath.id == payload.path_id,
                LearningPath.user_id == user_id,
            )
        )
        path = path_r.scalar_one_or_none()
        if path and path.resources:
            total = len(path.resources)
            done_r = await db.execute(
                select(LearningCompletion).where(
                    LearningCompletion.path_id == payload.path_id,
                    LearningCompletion.user_id == user_id,
                )
            )
            done = len(done_r.scalars().all()) + 1   # +1 for this new completion
            path.progress_pct = min(100, int(done / total * 100))
            if path.progress_pct >= 100:
                path.status = "completed"

    await db.flush()

    # Trigger skill-to-job flywheel asynchronously (best-effort)
    try:
        await on_skill_completed(user_id, payload.skill_name, db)
    except Exception as exc:
        logger.warning(f"Skill flywheel failed (non-critical): {exc}")

    return _completion_to_dict(completion)


# ─── Skill gap → paths suggestion ────────────────────────────────────────────

@router.get("/suggestions")
async def suggest_paths(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Suggest learning paths based on profile skill gaps vs. trending skills."""
    profile_r = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    profile = profile_r.scalar_one_or_none()

    if not profile:
        return {"suggestions": [], "message": "Set up your profile to get suggestions"}

    # Trending skills not yet on profile
    trending = [
        "Python", "TypeScript", "AWS", "Kubernetes", "LLMs / Generative AI",
        "dbt", "Terraform", "React", "FastAPI", "Data Engineering",
    ]
    user_skills = set(s.lower() for s in (profile.skills or []) + (profile.frameworks or []))
    suggestions = [s for s in trending if s.lower() not in user_skills][:5]

    return {"suggestions": suggestions}


# ─── Serialisers ─────────────────────────────────────────────────────────────

def _path_to_dict(p: LearningPath) -> dict:
    return {
        "id": str(p.id),
        "skill_name": p.skill_name,
        "current_level": p.current_level,
        "target_level": p.target_level,
        "estimated_hours": p.estimated_hours,
        "status": p.status,
        "progress_pct": p.progress_pct,
        "resources": p.resources or [],
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _resource_to_dict(r: LearningResource) -> dict:
    return {
        "id": str(r.id),
        "skill_name": r.skill_name,
        "title": r.title,
        "provider": r.provider,
        "url": r.url,
        "type": r.type,
        "duration_minutes": r.duration_minutes,
        "difficulty": r.difficulty,
        "is_free": r.is_free,
        "rating": r.rating,
        "tags": r.tags or [],
    }


def _completion_to_dict(c: LearningCompletion) -> dict:
    return {
        "id": str(c.id),
        "skill_name": c.skill_name,
        "path_id": str(c.path_id) if c.path_id else None,
        "resource_id": str(c.resource_id) if c.resource_id else None,
        "resource_url": c.resource_url,
        "rating_given": c.rating_given,
        "notes": c.notes,
        "completed_at": c.completed_at.isoformat() if c.completed_at else None,
    }
