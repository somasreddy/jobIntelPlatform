"""
Career State Service
─────────────────────────────────────────────────────────────────────────────
A single, read-only aggregation of a user's career-related data, assembled
live from existing tables. This is the backend for GET /api/career-state/ —
the shared "career state" other modules/agents read from.

DESIGN DECISION — computed read model, not a synced table
─────────────────────────────────────────────────────────
This is implemented as a stateless aggregation query (a service function
that runs live SELECTs against CandidateProfile / CareerGraph / CareerSkill /
CareerGoal / CareerMilestone / Application / VerifiedJob / LearningPath /
LearningCompletion and assembles a response), NOT a new persisted/denormalised
table that gets written to by every module that touches a profile, skill,
application, or learning-completion row.

Why: a synced table needs a write-hook in every code path that mutates any of
those source tables (profile.py, career_graph.py, applications.py,
learning.py, apply.py, autopilot.py, ...) to stay consistent. With many other
agents editing this codebase concurrently in the same batch, wiring correct
write-hooks into every one of those call sites (and keeping them correct as
those files keep changing) is a much larger and more error-prone surface than
a single read-side query. A live aggregation query can never drift out of
sync with the source tables because it has no independent state to drift
from — it always reflects whatever is in the DB at request time. The
trade-off is read cost (several SELECTs per request) instead of write
complexity; for a per-user dashboard-style endpoint this is the right side
of that trade-off. No new Alembic migration is needed for this reason either.

Sub-decisions worth documenting explicitly (asked for by the task spec):

* Skill gaps: `skill_gap_engine.analyzer.SkillGapAnalyzer.analyze()` already
  exists and does something related, but it (a) always makes a synchronous
  LLM call via `smart_chat` before returning (see `_generate_llm_insights` in
  skill_gap_engine/analyzer.py) and (b) is designed for the user-triggered
  "Skill Gap" page (POST /api/skill-gap/analyze), not for a shared read model
  that other agents may poll frequently. Baking an LLM round-trip into every
  GET of the career-state spine would make it slow, non-deterministic, and
  costly for every consumer. So career-state does NOT call that analyzer.
  Instead it uses a simple, deterministic presence/level comparison (the
  same idiom already used inside that analyzer — `tech.lower() in
  profile_lower` — and inside learning.suggest_paths()): real technology
  demand is aggregated (Counter) from the `technologies` field of the user's
  own VerifiedJob universe (filtered to the target role when one is set,
  else the general VERIFIED-job pool), and each in-demand skill is checked
  for presence (and CareerSkill level, if tracked) against the user's known
  skills. If there is no VERIFIED job data in the DB at all, this section is
  returned as unavailable with an explicit message — no hardcoded/fabricated
  demand numbers are substituted (per the "never fabricate data" rule), even
  though the existing analyzer does fall back to a hardcoded Counter in that
  situation. The full LLM-powered roadmap remains available via the existing
  POST /api/skill-gap/analyze endpoint; this read model only exposes
  presence/absence + demand ranking, not roadmap text.

* Fit score: `services/fit_score.compute_fit_score()` is the one existing fit
  formula in this codebase (used by career_graph.py's POST /fit-score,
  jobs.py's list endpoint, autopilot.py, and digest.py) and is reused
  verbatim here — no second formula is introduced. It is inherently
  job-specific (it scores a profile against one job posting), so there is no
  single stored "current fit score" anywhere in the schema. Rather than
  inventing one, this service computes it live against the user's own real
  Applications that have a linked VerifiedJob (capped, most recent first),
  preferring the "active pipeline" statuses, and reports the average +
  best-matching application. If the user has no applications linked to a
  real job yet, this section is returned as unavailable (not a fabricated
  score).

* Pipeline summary reuses `api.applications.VALID_STATUSES` (imported
  directly, not redefined) so the two can never drift apart.
"""
import re
import uuid
import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.database import (
    CandidateProfile,
    CareerGoal,
    CareerMilestone,
    CareerSkill,
    Application,
    VerifiedJob,
    LearningPath,
    LearningCompletion,
)
from services.fit_score import compute_fit_score

# Reused, not redefined — see module docstring ("Pipeline summary" bullet).
from api.applications import VALID_STATUSES

logger = logging.getLogger(__name__)

# Statuses considered "in-flight" for fit-score sampling purposes (a subset
# of VALID_STATUSES). Kept local because it's a fit-score sampling detail,
# not the pipeline-summary status enum itself (that one is imported above).
_ACTIVE_PIPELINE_STATUSES = {"Applied", "Assessment", "Responded", "Interview", "Offer"}

# Defensive caps so this stays a fast, frequently-pollable read model rather
# than an unbounded scan as data grows. The existing skill_gap_engine analyzer
# runs its equivalent query with no limit at all; we intentionally add one here.
_MAX_VERIFIED_JOBS_SCANNED = 500
_MAX_APPLICATIONS_SCORED = 50
_MAX_RECENT_COMPLETIONS = 5
_MAX_RECENT_MILESTONES = 5
_MAX_GAP_SKILLS = 15


def _tokenize(text: Optional[str]) -> set[str]:
    """Lowercase word-token set. Mirrors the tokenization idiom used in
    services/fit_score.py's _tokenize, kept local to avoid importing a
    private helper across module boundaries."""
    return set(re.findall(r"[a-z0-9]+", (text or "").lower()))


def _badge_for_score(score: int) -> str:
    """Mirrors the badge tiers inline in services/fit_score.compute_fit_score()
    (85/70/55/40) so an *averaged* score can still get a consistent badge
    label. Thresholds are data, kept in sync by comment — see fit_score.py."""
    if score >= 85:
        return "Excellent Fit"
    if score >= 70:
        return "Strong Fit"
    if score >= 55:
        return "Good Fit"
    if score >= 40:
        return "Partial Fit"
    return "Weak Fit"


# ─────────────────────────────────────────────────────────────────────────────
# Section builders
# ─────────────────────────────────────────────────────────────────────────────

def _build_profile_summary(profile: Optional[CandidateProfile], goal: Optional[CareerGoal]) -> dict:
    if not profile:
        return {
            "has_profile": False,
            "name": None,
            "current_role": None,
            "target_role": goal.target_role if goal else None,
            "experience_years": None,
            "current_location": None,
            "preferred_locations": [],
            "work_mode": None,
        }
    return {
        "has_profile": True,
        "name": profile.name,
        "current_role": profile.current_role,
        "target_role": goal.target_role if goal else None,
        "experience_years": profile.experience_years,
        "current_location": profile.current_location,
        "preferred_locations": list(profile.preferred_locations or []),
        "work_mode": profile.work_mode,
    }


async def _build_skill_gaps(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile: Optional[CandidateProfile],
    career_skills: list[CareerSkill],
    target_role: Optional[str],
) -> dict:
    try:
        known_levels: dict[str, int] = {s.skill_name.lower(): s.level for s in career_skills}
        known_names: set[str] = set(known_levels)
        if profile:
            for bucket in (profile.skills, profile.frameworks, profile.languages):
                known_names |= {str(s).lower() for s in (bucket or [])}

        # Real technology demand universe: VERIFIED jobs, newest first, capped.
        jobs_r = await db.execute(
            select(VerifiedJob.title, VerifiedJob.technologies)
            .where(VerifiedJob.verification_status == "VERIFIED")
            .order_by(VerifiedJob.created_at.desc())
            .limit(_MAX_VERIFIED_JOBS_SCANNED)
        )
        rows = jobs_r.all()

        if not rows:
            return {
                "available": False,
                "method": "presence_comparison_vs_verified_jobs",
                "target_role": target_role,
                "missing_skills": [],
                "present_skills": [],
                "jobs_analyzed": 0,
                "message": "No VERIFIED job postings in the database yet — nothing to compare skills against.",
            }

        role_tokens = _tokenize(target_role)
        scoped_rows = rows
        scoped_to_role = False
        if role_tokens:
            matched = [r for r in rows if _tokenize(r.title) & role_tokens]
            if matched:
                scoped_rows = matched
                scoped_to_role = True

        demand: Counter = Counter()
        for r in scoped_rows:
            for tech in (r.technologies or []):
                demand[str(tech)] += 1

        top = demand.most_common(_MAX_GAP_SKILLS)
        missing, present = [], []
        for skill, count in top:
            key = skill.lower()
            entry = {"skill": skill, "demand_count": count}
            if key in known_names:
                entry["level"] = known_levels.get(key)
                present.append(entry)
            else:
                missing.append(entry)

        return {
            "available": True,
            "method": "presence_comparison_vs_verified_jobs",
            "target_role": target_role,
            "scoped_to_target_role": scoped_to_role,
            "missing_skills": missing,
            "present_skills": present,
            "jobs_analyzed": len(scoped_rows),
        }
    except Exception as exc:
        logger.warning(f"career_state: skill gap section failed: {exc}")
        return {
            "available": False,
            "method": "presence_comparison_vs_verified_jobs",
            "target_role": target_role,
            "missing_skills": [],
            "present_skills": [],
            "jobs_analyzed": 0,
            "message": "Skill gap computation failed — see server logs.",
        }


async def _build_fit_score(
    db: AsyncSession,
    user_id: uuid.UUID,
    profile: Optional[CandidateProfile],
    goal: Optional[CareerGoal],
) -> dict:
    method = (
        "compute_fit_score() (services/fit_score.py), averaged live over the "
        "user's own Applications that have a linked job"
    )
    if not profile:
        return {
            "available": False, "method": method, "current_fit_score": None,
            "badge": None, "sample_size": 0, "sampled_statuses": None,
            "best_match": None,
            "message": "No candidate profile set up yet.",
        }
    try:
        apps_r = await db.execute(
            select(Application)
            .where(Application.user_id == user_id, Application.job_id.isnot(None))
            .order_by(Application.created_at.desc())
            .limit(_MAX_APPLICATIONS_SCORED)
        )
        apps = list(apps_r.scalars().all())
        if not apps:
            return {
                "available": False, "method": method, "current_fit_score": None,
                "badge": None, "sample_size": 0, "sampled_statuses": None,
                "best_match": None,
                "message": "No job applications with a linked job yet — nothing to score fit against.",
            }

        active = [a for a in apps if a.status in _ACTIVE_PIPELINE_STATUSES]
        sampled = active if active else apps
        sampled_statuses = "active_pipeline" if active else "all_applications"

        job_ids = [a.job_id for a in sampled]
        jobs_r = await db.execute(select(VerifiedJob).where(VerifiedJob.id.in_(job_ids)))
        jobs_by_id = {j.id: j for j in jobs_r.scalars().all()}

        scored = []
        for a in sampled:
            job = jobs_by_id.get(a.job_id)
            if not job:
                continue
            result = compute_fit_score(
                user_skills=list(profile.skills or []),
                user_frameworks=list(profile.frameworks or []),
                user_languages=list(profile.languages or []),
                user_experience_years=profile.experience_years,
                user_preferred_locations=list(profile.preferred_locations or []),
                user_work_mode=profile.work_mode,
                user_current_salary=profile.current_salary,
                user_target_role=goal.target_role if goal else None,
                user_target_salary_min=goal.target_salary_min if goal else None,
                job_title=job.title,
                job_description=job.description or "",
                job_requirements=list(job.technologies or []),
                job_experience_required=job.experience_required,
                job_location=job.location,
                job_work_mode=job.work_mode,
                job_salary_min=job.salary_min,
                job_salary_max=job.salary_max,
            )
            scored.append((a, job, result["fit_score"]))

        if not scored:
            return {
                "available": False, "method": method, "current_fit_score": None,
                "badge": None, "sample_size": 0, "sampled_statuses": None,
                "best_match": None,
                "message": "Applications exist but their linked jobs could not be found.",
            }

        avg = round(sum(s[2] for s in scored) / len(scored))
        best_app, best_job, best_score = max(scored, key=lambda t: t[2])

        return {
            "available": True,
            "method": method,
            "current_fit_score": avg,
            "badge": _badge_for_score(avg),
            "sample_size": len(scored),
            "sampled_statuses": sampled_statuses,
            "best_match": {
                "application_id": str(best_app.id),
                "job_id": str(best_job.id),
                "job_title": best_job.title,
                "organization": best_job.organization,
                "fit_score": best_score,
                "badge": _badge_for_score(best_score),
            },
        }
    except Exception as exc:
        logger.warning(f"career_state: fit score section failed: {exc}")
        return {
            "available": False, "method": method, "current_fit_score": None,
            "badge": None, "sample_size": 0, "sampled_statuses": None,
            "best_match": None,
            "message": "Fit score computation failed — see server logs.",
        }


async def _build_pipeline_summary(db: AsyncSession, user_id: uuid.UUID) -> dict:
    try:
        result = await db.execute(select(Application.status).where(Application.user_id == user_id))
        statuses = [row[0] for row in result.all()]
        counts = Counter(statuses)
        return {
            "total": len(statuses),
            "by_status": {s: counts.get(s, 0) for s in VALID_STATUSES},
            "active_count": sum(counts.get(s, 0) for s in _ACTIVE_PIPELINE_STATUSES),
        }
    except Exception as exc:
        logger.warning(f"career_state: pipeline summary failed: {exc}")
        return {"total": 0, "by_status": {s: 0 for s in VALID_STATUSES}, "active_count": 0}


async def _build_learning_progress(db: AsyncSession, user_id: uuid.UUID) -> dict:
    try:
        paths_r = await db.execute(select(LearningPath).where(LearningPath.user_id == user_id))
        paths = list(paths_r.scalars().all())
        active_paths = [p for p in paths if p.status == "active"]
        active_path_ids = [p.id for p in active_paths]
        resources_total = sum(len(p.resources or []) for p in active_paths)

        completions_in_active_paths = 0
        if active_path_ids:
            comp_count_r = await db.execute(
                select(LearningCompletion).where(
                    LearningCompletion.user_id == user_id,
                    LearningCompletion.path_id.in_(active_path_ids),
                )
            )
            completions_in_active_paths = len(comp_count_r.scalars().all())

        recent_r = await db.execute(
            select(LearningCompletion)
            .where(LearningCompletion.user_id == user_id)
            .order_by(LearningCompletion.completed_at.desc())
            .limit(_MAX_RECENT_COMPLETIONS)
        )
        recent = list(recent_r.scalars().all())
        recent_completions = [
            {
                "skill_name": c.skill_name,
                "path_id": str(c.path_id) if c.path_id else None,
                "completed_at": c.completed_at.isoformat() if c.completed_at else None,
                "rating_given": c.rating_given,
            }
            for c in recent
        ]
        skills_targeted_recently = list(dict.fromkeys(c.skill_name for c in recent))

        return {
            "total_paths": len(paths),
            "active_paths": len(active_paths),
            "active_path_resources_total": resources_total,
            "active_path_completions": completions_in_active_paths,
            "completion_pct": (
                round(completions_in_active_paths / resources_total * 100, 1)
                if resources_total else None
            ),
            "recent_completions": recent_completions,
            "skills_targeted_recently": skills_targeted_recently,
        }
    except Exception as exc:
        logger.warning(f"career_state: learning progress section failed: {exc}")
        return {
            "total_paths": 0, "active_paths": 0, "active_path_resources_total": 0,
            "active_path_completions": 0, "completion_pct": None,
            "recent_completions": [], "skills_targeted_recently": [],
        }


def _goal_to_dict(g: CareerGoal) -> dict:
    return {
        "id": str(g.id),
        "target_role": g.target_role,
        "target_company": g.target_company,
        "target_salary_min": g.target_salary_min,
        "target_salary_max": g.target_salary_max,
        "target_location": g.target_location,
        "timeline_months": g.timeline_months,
        "work_mode": g.work_mode,
    }


def _milestone_to_dict(m: CareerMilestone) -> dict:
    return {
        "id": str(m.id),
        "type": m.type,
        "title": m.title,
        "company": m.company,
        "milestone_date": m.milestone_date,
        "impact_statement": m.impact_statement,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


async def _build_goals_and_milestones(db: AsyncSession, user_id: uuid.UUID, goal: Optional[CareerGoal]) -> dict:
    try:
        milestones_r = await db.execute(
            select(CareerMilestone)
            .where(CareerMilestone.user_id == user_id)
            .order_by(CareerMilestone.milestone_date.desc().nullslast())
            .limit(_MAX_RECENT_MILESTONES)
        )
        milestones = list(milestones_r.scalars().all())
        return {
            "active_goal": _goal_to_dict(goal) if goal else None,
            "recent_milestones": [_milestone_to_dict(m) for m in milestones],
        }
    except Exception as exc:
        logger.warning(f"career_state: goals/milestones section failed: {exc}")
        return {"active_goal": _goal_to_dict(goal) if goal else None, "recent_milestones": []}


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

async def get_career_state(user_id: uuid.UUID, db: AsyncSession) -> dict:
    """
    Assemble the full career-state read model for one user. Pure aggregation —
    no writes. See module docstring for the computed-read-model design
    decision and the skill-gap / fit-score sub-decisions.
    """
    profile_r = await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == user_id))
    profile = profile_r.scalar_one_or_none()

    goal_r = await db.execute(
        select(CareerGoal)
        .where(CareerGoal.user_id == user_id, CareerGoal.is_active == True)
        .order_by(CareerGoal.updated_at.desc())
    )
    goal = goal_r.scalars().first()

    skills_r = await db.execute(select(CareerSkill).where(CareerSkill.user_id == user_id))
    career_skills = list(skills_r.scalars().all())

    target_role = (goal.target_role if goal else None) or (profile.current_role if profile else None)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "user_id": str(user_id),
        "profile": _build_profile_summary(profile, goal),
        "skill_gaps": await _build_skill_gaps(db, user_id, profile, career_skills, target_role),
        "fit_score": await _build_fit_score(db, user_id, profile, goal),
        "pipeline": await _build_pipeline_summary(db, user_id),
        "learning": await _build_learning_progress(db, user_id),
        "career_goals": await _build_goals_and_milestones(db, user_id, goal),
    }
