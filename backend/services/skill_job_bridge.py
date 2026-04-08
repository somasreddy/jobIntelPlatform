"""
Skill-to-Job Flywheel Service
On skill completion: update career graph → recompute health → notify user
of newly qualified jobs → trigger fit score update.

This is called after LearningCompletion is recorded.
"""
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.database import (
    CandidateProfile,
    CareerGraph,
    CareerSkill,
    LearningCompletion,
    LearningPath,
    Notification,
    VerifiedJob,
)
from services.career_health import compute_career_health
from services.fit_score import compute_fit_score

logger = logging.getLogger(__name__)


async def on_skill_completed(
    user_id: uuid.UUID,
    skill_name: str,
    db: AsyncSession,
) -> dict:
    """
    Triggered when a user completes a learning resource for a skill.

    Steps:
    1. Upgrade CareerSkill level if it exists
    2. Recompute Career Health Score
    3. Scan recent jobs for newly qualified matches (fit score improved)
    4. Create a notification if new jobs unlocked
    5. Return summary
    """
    result = {"skill": skill_name, "health_score_delta": 0, "new_jobs_unlocked": 0}

    # ── 1. Upgrade skill level ────────────────────────────────────────────────
    skill_r = await db.execute(
        select(CareerSkill).where(
            CareerSkill.user_id == user_id,
            CareerSkill.skill_name.ilike(skill_name),
        )
    )
    skill = skill_r.scalar_one_or_none()
    if skill:
        old_level = skill.level
        skill.level = min(5, skill.level + 1)
        skill.last_used_year = datetime.now().year
        logger.info(f"Upgraded {skill_name} level {old_level} → {skill.level} for user {user_id}")
    else:
        # Add it as a new skill
        graph_r = await db.execute(
            select(CareerGraph).where(CareerGraph.user_id == user_id)
        )
        graph = graph_r.scalar_one_or_none()
        if graph:
            new_skill = CareerSkill(
                graph_id=graph.id,
                user_id=user_id,
                skill_name=skill_name,
                level=2,
                last_used_year=datetime.now().year,
            )
            db.add(new_skill)
            logger.info(f"Added new skill {skill_name} for user {user_id}")

    # ── 2. Recompute health score ─────────────────────────────────────────────
    graph_r2 = await db.execute(
        select(CareerGraph).where(CareerGraph.user_id == user_id)
    )
    graph = graph_r2.scalar_one_or_none()
    old_health = graph.health_score if graph else 0

    health_data = await compute_career_health(user_id, db, graph=graph)
    new_health = health_data["health_score"]
    result["health_score_delta"] = new_health - old_health

    # ── 3. Scan recent jobs for newly qualified matches ───────────────────────
    profile_r = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    profile = profile_r.scalar_one_or_none()

    newly_qualified = []
    if profile:
        from datetime import timedelta
        from sqlalchemy import func as sqlfunc
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        jobs_r = await db.execute(
            select(VerifiedJob)
            .where(VerifiedJob.created_at >= cutoff)
            .limit(50)
        )
        recent_jobs = jobs_r.scalars().all()

        for job in recent_jobs:
            fit = compute_fit_score(
                user_skills=list(profile.skills or []) + [skill_name],
                user_frameworks=list(profile.frameworks or []),
                user_languages=list(profile.languages or []),
                user_experience_years=profile.experience_years,
                user_preferred_locations=list(profile.preferred_locations or []),
                user_work_mode=profile.work_mode,
                user_current_salary=profile.current_salary,
                job_title=job.title,
                job_description=job.description or "",
                job_requirements=list(job.requirements or []) + list(job.technologies or []),
                job_experience_required=job.experience_required,
                job_location=job.location,
                job_work_mode=job.work_mode,
                job_salary_min=job.salary_min,
                job_salary_max=job.salary_max,
            )
            # Only notify if score crossed 80 threshold
            if fit["fit_score"] >= 80:
                old_fit = compute_fit_score(
                    user_skills=list(profile.skills or []),
                    user_frameworks=list(profile.frameworks or []),
                    user_languages=list(profile.languages or []),
                    user_experience_years=profile.experience_years,
                    user_preferred_locations=list(profile.preferred_locations or []),
                    user_work_mode=profile.work_mode,
                    user_current_salary=profile.current_salary,
                    job_title=job.title,
                    job_description=job.description or "",
                    job_requirements=list(job.requirements or []) + list(job.technologies or []),
                    job_experience_required=job.experience_required,
                    job_location=job.location,
                    job_work_mode=job.work_mode,
                    job_salary_min=job.salary_min,
                    job_salary_max=job.salary_max,
                )
                if old_fit["fit_score"] < 80:
                    newly_qualified.append({"title": job.title, "org": job.organization, "score": fit["fit_score"]})

    result["new_jobs_unlocked"] = len(newly_qualified)

    # ── 4. Create notification ────────────────────────────────────────────────
    notif_body = f"You completed {skill_name}"
    if newly_qualified:
        examples = ", ".join(f"{j['title']} at {j['org']}" for j in newly_qualified[:2])
        notif_body += f" — {len(newly_qualified)} new job match(es) unlocked! ({examples})"
    elif result["health_score_delta"] > 0:
        notif_body += f" — career health score +{result['health_score_delta']}pts"

    notif = Notification(
        user_id=user_id,
        type="skill_completed",
        title=f"🎯 {skill_name} completed!",
        body=notif_body,
        action_url="/learn" if not newly_qualified else "/jobs",
        extra_data={"skill": skill_name, "new_jobs": len(newly_qualified)},
    )
    db.add(notif)

    logger.info(f"Skill flywheel: {skill_name} — health +{result['health_score_delta']}, {len(newly_qualified)} new jobs")
    return result
