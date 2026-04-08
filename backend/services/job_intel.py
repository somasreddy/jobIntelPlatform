"""
Job Intelligence Flags
Computes ghost_job_risk, hiring_velocity, competition_level,
repost_detected, job_freshness_hours from VerifiedJob data.

All functions are pure/cheap — no extra DB queries per job.
Hiring velocity is passed in from a pre-computed org counts dict.
"""
from datetime import datetime, timezone
from typing import Optional


def compute_intel_flags(
    job_id: str,
    title: str,
    organization: str,
    description: Optional[str],
    application_link: Optional[str],
    salary_min: Optional[float],
    salary_max: Optional[float],
    work_mode: Optional[str],
    requirements: list,
    created_at: datetime,
    posted_date: Optional[str],
    org_recent_count: int = 1,   # how many jobs this org posted in recent batch
) -> dict:
    """
    Returns a dict of intel flags for a single job:
      ghost_job_risk     : "High" | "Medium" | "Low"
      hiring_velocity    : "Fast" | "Normal" | "Slow"
      competition_level  : "High" | "Medium" | "Low"
      repost_detected    : bool
      job_freshness_hours: int
      salary_disclosed   : bool
    """
    now = datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    # ── Freshness ─────────────────────────────────────────────────────────────
    freshness_hours = max(0, int((now - created_at).total_seconds() / 3600))

    # ── Salary disclosed ──────────────────────────────────────────────────────
    salary_disclosed = bool(salary_min or salary_max)

    # ── Ghost job risk ────────────────────────────────────────────────────────
    ghost_score = 0
    if not salary_disclosed:
        ghost_score += 2                     # no salary is suspicious
    if not application_link:
        ghost_score += 2                     # no apply link
    desc_len = len(description or "")
    if desc_len < 200:
        ghost_score += 2                     # very thin description
    elif desc_len < 600:
        ghost_score += 1
    if freshness_hours > 168:               # older than 7 days
        ghost_score += 2
    elif freshness_hours > 72:
        ghost_score += 1

    ghost_job_risk = "High" if ghost_score >= 5 else "Medium" if ghost_score >= 3 else "Low"

    # ── Repost detected ───────────────────────────────────────────────────────
    repost_detected = False
    if posted_date:
        try:
            posted_dt = datetime.fromisoformat(posted_date.replace("Z", "+00:00"))
            if posted_dt.tzinfo is None:
                posted_dt = posted_dt.replace(tzinfo=timezone.utc)
            # If posted_date is more than 5 days before created_at, likely a repost
            delta_days = (created_at - posted_dt).days
            repost_detected = delta_days > 5
        except Exception:
            pass

    # ── Competition level ─────────────────────────────────────────────────────
    # Remote + senior + few requirements = less competition
    # Remote tends to have more applicants globally
    comp_score = 0
    if work_mode and work_mode.lower() in ("remote", "any"):
        comp_score += 2
    req_count = len(requirements)
    if req_count > 10:
        comp_score += 2
    elif req_count > 5:
        comp_score += 1
    senior_keywords = {"senior", "lead", "principal", "staff", "director", "vp"}
    if not any(kw in title.lower() for kw in senior_keywords):
        comp_score += 1   # entry/mid level gets more applicants

    competition_level = "High" if comp_score >= 4 else "Medium" if comp_score >= 2 else "Low"

    # ── Hiring velocity ───────────────────────────────────────────────────────
    # Based on how many jobs this org posted recently
    if org_recent_count >= 5:
        hiring_velocity = "Fast"
    elif org_recent_count >= 2:
        hiring_velocity = "Normal"
    else:
        hiring_velocity = "Slow"

    return {
        "ghost_job_risk": ghost_job_risk,
        "hiring_velocity": hiring_velocity,
        "competition_level": competition_level,
        "repost_detected": repost_detected,
        "job_freshness_hours": freshness_hours,
        "salary_disclosed": salary_disclosed,
    }
