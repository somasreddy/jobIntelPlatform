"""
Job Fit Score Service
Computes a multi-dimensional match score (0-100) between a user's profile and a job posting.

Dimensions:
  skills_match       0.35  — technical skill overlap
  seniority_match    0.20  — years of experience alignment
  location_match     0.15  — location / work-mode compatibility
  salary_match       0.15  — salary range overlap
  title_match        0.15  — job title similarity to target role
"""
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Weights ─────────────────────────────────────────────────────────────────
_WEIGHTS = {
    "skills_match":    0.35,
    "seniority_match": 0.20,
    "location_match":  0.15,
    "salary_match":    0.15,
    "title_match":     0.15,
}


def _tokenize(text: str) -> set[str]:
    """Lowercase, split on punctuation/spaces, return token set."""
    return set(re.findall(r"[a-z0-9#+\-.]+", text.lower()))


def _skills_match(
    user_skills: list[str],
    job_text: str,
    job_requirements: list[str],
) -> tuple[int, str]:
    """Fraction of user skills mentioned in the JD."""
    if not user_skills:
        return 0, "No skills on profile"

    corpus = job_text.lower() + " " + " ".join(job_requirements).lower()
    matched = sum(1 for s in user_skills if s.lower() in corpus)
    ratio = matched / len(user_skills)
    score = int(ratio * 100)
    label = (
        f"Strong match — {matched}/{len(user_skills)} skills align" if score >= 70
        else f"Partial match — {matched}/{len(user_skills)} skills align" if score >= 40
        else f"Weak match — only {matched}/{len(user_skills)} skills align"
    )
    return score, label


def _seniority_match(
    user_years: Optional[int],
    job_experience_required: Optional[int],
) -> tuple[int, str]:
    """How well user experience aligns with job requirements."""
    if user_years is None or job_experience_required is None:
        return 60, "Experience not specified"

    diff = user_years - job_experience_required
    if -1 <= diff <= 3:
        score = 100   # perfect or slight over-qualified
    elif diff > 3:
        score = max(60, 100 - (diff - 3) * 8)   # over-qualified penalty
    else:
        # Under-qualified
        gap = abs(diff)
        score = max(0, 100 - gap * 20)

    label = (
        "Experience aligns perfectly" if score >= 90
        else "Slightly over/under-qualified" if score >= 60
        else f"Experience gap: {abs(diff)} yr(s)"
    )
    return score, label


def _location_match(
    user_preferred: list[str],
    user_work_mode: Optional[str],
    job_location: Optional[str],
    job_work_mode: Optional[str],
) -> tuple[int, str]:
    """Location / work-mode compatibility."""
    # Full remote anywhere
    if job_work_mode and "remote" in job_work_mode.lower():
        return 100, "Remote — location irrelevant"

    if user_work_mode and "remote" in (user_work_mode or "").lower():
        if job_work_mode and "on-site" in job_work_mode.lower():
            return 20, "Conflict: you want remote, role is on-site"

    # Location string overlap
    if job_location and user_preferred:
        job_loc_lower = job_location.lower()
        for pref in user_preferred:
            if pref.lower() in job_loc_lower or job_loc_lower in pref.lower():
                return 100, f"Location match: {pref}"

    if not user_preferred:
        return 70, "No preferred locations set"

    return 40, f"Location mismatch ({job_location})"


def _salary_match(
    user_current: Optional[int],
    user_target_min: Optional[int],
    job_min: Optional[int],
    job_max: Optional[int],
) -> tuple[int, str]:
    """Does job salary range overlap with user expectations?"""
    target = user_target_min or (user_current and int(user_current * 1.15))
    if not target or (not job_min and not job_max):
        return 70, "Salary not specified"

    job_mid = ((job_min or 0) + (job_max or job_min or 0)) / 2
    if job_mid == 0:
        return 70, "Salary not specified"

    ratio = job_mid / target
    if 0.90 <= ratio <= 1.30:
        score = 100
        label = f"Salary aligns (${int(job_mid)}k)"
    elif ratio < 0.90:
        pct_below = int((1 - ratio) * 100)
        score = max(0, 100 - pct_below * 2)
        label = f"Below target by {pct_below}%"
    else:
        score = 90  # above target is fine
        label = f"Above target (${int(job_mid)}k)"

    return score, label


def _title_match(
    user_target_role: Optional[str],
    job_title: str,
) -> tuple[int, str]:
    """Semantic title similarity using token overlap."""
    if not user_target_role:
        return 60, "No target role set"

    user_tokens = _tokenize(user_target_role)
    job_tokens = _tokenize(job_title)

    if not user_tokens:
        return 60, "No target role tokens"

    overlap = user_tokens & job_tokens
    score = int(len(overlap) / max(len(user_tokens), 1) * 100)
    score = min(100, score)

    label = (
        "Strong title alignment" if score >= 70
        else f"Partial title match ({len(overlap)} token(s))" if score >= 30
        else "Title diverges from goal"
    )
    return score, label


# ─── Main entry point ─────────────────────────────────────────────────────────

def compute_fit_score(
    *,
    # User profile fields
    user_skills: list[str],
    user_frameworks: list[str],
    user_languages: list[str],
    user_experience_years: Optional[int],
    user_preferred_locations: list[str],
    user_work_mode: Optional[str],
    user_current_salary: Optional[int],
    user_target_role: Optional[str] = None,
    user_target_salary_min: Optional[int] = None,
    # Job fields
    job_title: str,
    job_description: str = "",
    job_requirements: list[str] = None,
    job_experience_required: Optional[int] = None,
    job_location: Optional[str] = None,
    job_work_mode: Optional[str] = None,
    job_salary_min: Optional[int] = None,
    job_salary_max: Optional[int] = None,
) -> dict:
    """
    Compute Job Fit Score.  Returns dict with total score, per-dimension
    breakdown, and badge label.  This is a pure function — no DB calls.
    """
    if job_requirements is None:
        job_requirements = []

    all_user_skills = user_skills + user_frameworks + user_languages

    dims = {
        "skills_match": _skills_match(
            all_user_skills, job_description, job_requirements
        ),
        "seniority_match": _seniority_match(
            user_experience_years, job_experience_required
        ),
        "location_match": _location_match(
            user_preferred_locations, user_work_mode, job_location, job_work_mode
        ),
        "salary_match": _salary_match(
            user_current_salary, user_target_salary_min, job_salary_min, job_salary_max
        ),
        "title_match": _title_match(user_target_role, job_title),
    }

    total = int(sum(dims[k][0] * _WEIGHTS[k] for k in _WEIGHTS))

    breakdown = {
        k: {
            "score": v[0],
            "label": v[1],
            "weight": int(_WEIGHTS[k] * 100),
        }
        for k, v in dims.items()
    }

    badge = (
        "Excellent Fit" if total >= 85
        else "Strong Fit" if total >= 70
        else "Good Fit" if total >= 55
        else "Partial Fit" if total >= 40
        else "Weak Fit"
    )

    return {
        "fit_score": total,
        "badge": badge,
        "breakdown": breakdown,
    }
