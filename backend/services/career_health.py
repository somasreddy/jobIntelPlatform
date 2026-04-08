"""
Career Health Score Service
Computes a 0-100 composite score measuring a user's career fitness across six dimensions.

Score = weighted_average(
  skills_recency        * 0.20,
  profile_completeness  * 0.15,
  application_activity  * 0.15,
  interview_readiness   * 0.20,
  goal_alignment        * 0.15,
  market_demand         * 0.15,
)
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models.database import (
    CandidateProfile,
    Application,
    CareerGraph,
    CareerSkill,
    CareerGoal,
    CareerMilestone,
    MasterStory,
)

logger = logging.getLogger(__name__)

# ─── Weights ─────────────────────────────────────────────────────────────────
_WEIGHTS = {
    "skills_recency":        0.20,
    "profile_completeness":  0.15,
    "application_activity":  0.15,
    "interview_readiness":   0.20,
    "goal_alignment":        0.15,
    "market_demand":         0.15,
}

# High-demand skill keywords (simple heuristic — can be replaced by market data)
_HOT_SKILLS = {
    "python", "typescript", "rust", "go", "kubernetes", "terraform", "aws",
    "gcp", "azure", "llm", "openai", "langchain", "react", "next.js", "nextjs",
    "fastapi", "kafka", "spark", "dbt", "airflow", "mlflow", "pytorch",
    "machine learning", "data engineering", "devops", "platform engineering",
    "product management", "growth", "ai", "generative ai",
}


# ─── Individual dimension calculators ────────────────────────────────────────

def _skills_recency_score(skills: list[CareerSkill]) -> tuple[int, str]:
    """Score based on how recently skills were used and their market demand."""
    if not skills:
        return 0, "No skills recorded"

    current_year = datetime.now().year
    total = 0.0

    for sk in skills:
        base = (sk.level or 1) * 16  # 1-5 → 16-80
        # Recency bonus — skills used recently are worth more
        if sk.last_used_year:
            age = current_year - sk.last_used_year
            recency = max(0, 1 - age * 0.12)
        else:
            recency = 0.5  # unknown — neutral

        # Trending bonus
        is_hot = sk.skill_name.lower() in _HOT_SKILLS
        trend_boost = 1.2 if is_hot else 1.0

        total += base * recency * trend_boost

    # Normalise: 5 expert hot skills fully used = ~80*1.2 * 5 = 480 → cap at 100
    score = min(100, int(total / max(len(skills), 1) * 1.5))
    label = (
        "Strong skill portfolio" if score >= 80
        else "Good skills, some outdated" if score >= 60
        else "Skills need refreshing"
    )
    return score, label


def _profile_completeness_score(profile: Optional[CandidateProfile]) -> tuple[int, str]:
    """Score based on how complete the candidate profile is."""
    if not profile:
        return 0, "Profile not set up"

    checks = {
        "Name":               bool(profile.name and profile.name.strip()),
        "Current role":       bool(profile.current_role),
        "Experience years":   profile.experience_years is not None,
        "Location":           bool(profile.current_location),
        "Skills":             bool(profile.skills),
        "Frameworks":         bool(profile.frameworks),
        "Languages":          bool(profile.languages),
        "Certifications":     bool(profile.certifications),
        "Resume text":        bool(profile.base_resume_text and len(profile.base_resume_text) > 100),
        "Work mode":          bool(profile.work_mode),
    }
    filled = sum(checks.values())
    score = int(filled / len(checks) * 100)
    missing = [k for k, v in checks.items() if not v]
    label = (
        "Profile complete" if score >= 90
        else f"Missing: {', '.join(missing[:3])}" if missing
        else "Profile needs work"
    )
    return score, label


def _application_activity_score(applications: list[Application]) -> tuple[int, str]:
    """Score based on job application velocity and pipeline health."""
    if not applications:
        return 0, "No applications yet"

    now = datetime.now(timezone.utc)
    last_30 = [a for a in applications if a.created_at and (now - a.created_at).days <= 30]
    last_90 = [a for a in applications if a.created_at and (now - a.created_at).days <= 90]

    # Active pipeline — non-rejected recent apps
    active_statuses = {"Applied", "Screening", "Interview", "Offer", "Saved"}
    active = [a for a in last_90 if a.status in active_statuses]

    velocity_score = min(100, len(last_30) * 10)   # 10 apps/month = 100
    pipeline_score = min(100, len(active) * 7)      # 14 active = 100
    score = int(velocity_score * 0.5 + pipeline_score * 0.5)

    label = (
        "Active job search" if score >= 70
        else "Slow pipeline — increase activity" if score >= 30
        else "Search not started"
    )
    return score, label


def _interview_readiness_score(stories: int, applications: list[Application]) -> tuple[int, str]:
    """Score based on story bank size and interview performance signals."""
    story_score = min(100, stories * 8)   # 12 stories = ~96

    # Look for interview stages reached
    interview_reached = sum(
        1 for a in applications
        if a.status in {"Interview", "Offer", "Negotiating"}
    )
    perf_score = min(100, interview_reached * 15)

    score = int(story_score * 0.6 + perf_score * 0.4)
    label = (
        "Interview-ready" if score >= 75
        else f"Build more stories ({stories} recorded)" if stories < 8
        else "Good preparation, keep practising"
    )
    return score, label


def _goal_alignment_score(goals: list[CareerGoal], profile: Optional[CandidateProfile]) -> tuple[int, str]:
    """Score based on whether goals are set and aligned with the profile."""
    active_goals = [g for g in goals if g.is_active]
    if not active_goals:
        return 0, "No career goals set"

    g = active_goals[0]
    checks = [
        bool(g.target_role),
        bool(g.target_salary_min),
        bool(g.timeline_months),
        bool(g.work_mode),
        bool(g.target_location or (profile and profile.preferred_locations)),
    ]
    completeness = sum(checks) / len(checks)
    score = int(completeness * 100)
    label = (
        "Goals clearly defined" if score >= 80
        else "Goals set but incomplete"
    )
    return score, label


def _market_demand_score(skills: list[CareerSkill], profile: Optional[CandidateProfile]) -> tuple[int, str]:
    """Score based on how in-demand the user's skill set is."""
    all_skills: set[str] = set()

    for sk in skills:
        all_skills.add(sk.skill_name.lower())

    if profile:
        for s in (profile.skills or []):
            all_skills.add(str(s).lower())
        for s in (profile.frameworks or []):
            all_skills.add(str(s).lower())

    if not all_skills:
        return 0, "No skills to evaluate"

    hot_count = sum(1 for s in all_skills if s in _HOT_SKILLS)
    ratio = hot_count / max(len(all_skills), 1)

    # Trending score average from CareerSkill entries
    avg_trend = (
        sum(sk.trending_score for sk in skills) / len(skills)
        if skills else 0.0
    )

    score = int((ratio * 0.6 + avg_trend * 0.4) * 100)
    score = min(100, score)
    label = (
        "High market demand" if score >= 70
        else "Moderate market demand" if score >= 40
        else "Add in-demand skills"
    )
    return score, label


# ─── Main entry point ─────────────────────────────────────────────────────────

async def compute_career_health(
    user_id: uuid.UUID,
    db: AsyncSession,
    graph: Optional[CareerGraph] = None,
) -> dict:
    """
    Compute the Career Health Score for a user and return the full breakdown.
    If a CareerGraph row is provided, it is updated in-place.
    """
    # Load profile
    profile_result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()

    # Load applications
    app_result = await db.execute(
        select(Application).where(Application.user_id == user_id)
    )
    applications = list(app_result.scalars().all())

    # Load career skills
    skills_result = await db.execute(
        select(CareerSkill).where(CareerSkill.user_id == user_id)
    )
    skills = list(skills_result.scalars().all())

    # Load career goals
    goals_result = await db.execute(
        select(CareerGoal).where(CareerGoal.user_id == user_id)
    )
    goals = list(goals_result.scalars().all())

    # Story bank count
    story_result = await db.execute(
        select(func.count()).select_from(MasterStory).where(MasterStory.user_id == user_id)
    )
    story_count = story_result.scalar_one() or 0

    # ── Compute dimensions ───────────────────────────────────────────────────
    dims: dict[str, tuple[int, str]] = {
        "skills_recency":       _skills_recency_score(skills),
        "profile_completeness": _profile_completeness_score(profile),
        "application_activity": _application_activity_score(applications),
        "interview_readiness":  _interview_readiness_score(story_count, applications),
        "goal_alignment":       _goal_alignment_score(goals, profile),
        "market_demand":        _market_demand_score(skills, profile),
    }

    # ── Weighted total ───────────────────────────────────────────────────────
    total = int(sum(dims[k][0] * _WEIGHTS[k] for k in _WEIGHTS))

    breakdown = {
        k: {"score": v[0], "label": v[1], "weight": int(_WEIGHTS[k] * 100)}
        for k, v in dims.items()
    }

    # ── Persist to CareerGraph if provided ──────────────────────────────────
    if graph is not None:
        graph.health_score = total
        graph.health_breakdown = breakdown
        graph.last_computed = datetime.now(timezone.utc)

    insights = _generate_insights(total, dims)

    return {
        "health_score": total,
        "breakdown": breakdown,
        "insights": insights,
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


def _generate_insights(score: int, dims: dict) -> list[dict]:
    """Return top-3 actionable improvement suggestions sorted by impact."""
    suggestions = []

    for dim, (dim_score, label) in dims.items():
        if dim_score < 60:
            weight = _WEIGHTS[dim]
            potential_gain = int((60 - dim_score) * weight)
            suggestions.append({
                "dimension": dim,
                "current_score": dim_score,
                "label": label,
                "potential_gain": potential_gain,
                "action": _action_for_dim(dim, dim_score),
            })

    suggestions.sort(key=lambda x: x["potential_gain"], reverse=True)
    return suggestions[:3]


def _action_for_dim(dim: str, score: int) -> str:
    actions = {
        "skills_recency": (
            "Add recent projects or use-cases that demonstrate your latest skills"
            if score < 30 else "Update last-used year for your core skills"
        ),
        "profile_completeness": "Complete your profile — add resume text, certifications, and preferred locations",
        "application_activity": "Apply to at least 5 roles this week to build momentum",
        "interview_readiness": "Add 5 STAR stories to your story bank",
        "goal_alignment": "Set a target role, salary range, and timeline in Career Goals",
        "market_demand": "Add 3-5 high-demand skills (Python, TypeScript, AWS, LLMs) to your profile",
    }
    return actions.get(dim, "Improve this dimension")
