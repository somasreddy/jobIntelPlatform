"""Deterministic ranking over already-retrieved job candidates."""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import asdict, dataclass
from statistics import fmean
from typing import Iterable


RANKING_VERSION = "job-rank-v1.0.0"
WEIGHTS = {
    "match": 0.35,
    "trust": 0.18,
    "freshness": 0.16,
    "preferences": 0.15,
    "salary_quality": 0.08,
    "verification": 0.08,
}
_SYNONYM_GROUPS = (
    {"ai", "artificial intelligence", "ml", "machine learning"},
    {"software engineer", "software developer", "application developer"},
    {"platform engineer", "devops", "site reliability engineer", "sre", "cloud engineer"},
    {"product manager", "product owner", "product lead"},
    {"solutions architect", "solution architect", "enterprise architect"},
    {"forward deployed engineer", "deployment engineer", "customer engineer"},
)


@dataclass(frozen=True)
class RankingPreferences:
    target_role: str = ""
    work_mode: str = ""
    locations: tuple[str, ...] = ()
    minimum_salary: float | None = None


def _clamp(value: float | int | None) -> int:
    return round(max(0.0, min(100.0, float(value or 0))))


def _normalized(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _expanded_terms(value: str) -> set[str]:
    normalized = _normalized(value)
    terms = {normalized} if normalized else set()
    words = set(normalized.split())
    for group in _SYNONYM_GROUPS:
        if any(term in normalized or term in words for term in group):
            terms.update(group)
    return terms


def _preference_score(job: dict, preferences: RankingPreferences) -> tuple[int, list[dict]]:
    checks: list[tuple[str, bool, str]] = []
    title = _normalized(job.get("title"))
    if preferences.target_role:
        role_match = any(term and (term in title or title in term) for term in _expanded_terms(preferences.target_role))
        checks.append(("target_role", role_match, "Target-role alignment"))

    if preferences.work_mode and _normalized(preferences.work_mode) not in {"", "any"}:
        mode_match = _normalized(preferences.work_mode) == _normalized(job.get("workMode"))
        checks.append(("work_mode", mode_match, "Preferred work mode"))

    if preferences.locations:
        location = _normalized(job.get("location"))
        location_match = any(_normalized(value) in location for value in preferences.locations if value)
        if _normalized(job.get("workMode")) == "remote":
            location_match = True
        checks.append(("location", location_match, "Preferred location"))

    if preferences.minimum_salary:
        salary_max = job.get("salaryMax") or job.get("salaryMin")
        if salary_max:
            checks.append(("salary_target", float(salary_max) >= preferences.minimum_salary, "Salary target"))

    if not checks:
        return 50, []
    score = round(sum(100 if passed else 20 for _, passed, _ in checks) / len(checks))
    reasons = [
        {
            "code": f"preference_{code}_{'met' if passed else 'missed'}",
            "label": label,
            "impact": "positive" if passed else "negative",
            "score": 100 if passed else 20,
        }
        for code, passed, label in checks
    ]
    return score, reasons


def rank_job(job: dict, preferences: RankingPreferences | None = None) -> dict:
    preferences = preferences or RankingPreferences()
    match = _clamp(job.get("fitScore") if job.get("fitScore") is not None else job.get("matchScore") or 50)

    quality = str(job.get("sourceQuality") or "low").lower()
    trust_base = {"high": 100, "medium": 65, "low": 30}.get(quality, 30)
    confidence = _clamp(job.get("extractionConfidence") or trust_base)
    trust = round(trust_base * 0.6 + confidence * 0.4)

    if job.get("freshnessScore") is not None:
        freshness = _clamp(job.get("freshnessScore"))
    else:
        hours = job.get("jobFreshnessHours")
        freshness = 35 if hours is None else 100 if hours <= 72 else 70 if hours <= 336 else 20

    salary_min = job.get("salaryMin")
    salary_max = job.get("salaryMax")
    salary_quality = 100 if salary_min and salary_max else 65 if salary_min or salary_max else 25

    verification_status = str(job.get("verificationStatus") or "UNVERIFIED").upper()
    verification = {"VERIFIED": 100, "PENDING": 55, "UNVERIFIED": 25}.get(verification_status, 25)
    preference_score, preference_reasons = _preference_score(job, preferences)

    components = {
        "match": match,
        "trust": trust,
        "freshness": freshness,
        "preferences": preference_score,
        "salary_quality": salary_quality,
        "verification": verification,
    }
    score = round(sum(components[name] * WEIGHTS[name] for name in WEIGHTS))

    reasons = [
        {
            "code": "match_evidence",
            "label": "Candidate-to-role match",
            "impact": "positive" if match >= 65 else "negative",
            "score": match,
        },
        {
            "code": f"source_trust_{quality}",
            "label": f"{quality.title()} source trust",
            "impact": "positive" if trust >= 70 else "negative",
            "score": trust,
        },
        {
            "code": "fresh_posting" if freshness >= 75 else "aging_posting" if freshness >= 45 else "stale_posting",
            "label": "Posting freshness",
            "impact": "positive" if freshness >= 75 else "neutral" if freshness >= 45 else "negative",
            "score": freshness,
        },
        {
            "code": "salary_range_published" if salary_quality == 100 else "salary_partial" if salary_quality == 65 else "salary_not_published",
            "label": "Salary data quality",
            "impact": "positive" if salary_quality == 100 else "neutral" if salary_quality == 65 else "negative",
            "score": salary_quality,
        },
        {
            "code": f"verification_{verification_status.lower()}",
            "label": f"{verification_status.title()} posting",
            "impact": "positive" if verification_status == "VERIFIED" else "negative",
            "score": verification,
        },
        *preference_reasons,
    ]

    ranked = dict(job)
    ranked.update({
        "rankingScore": score,
        "rankingVersion": RANKING_VERSION,
        "rankingComponents": components,
        "rankingReasons": reasons,
    })
    return ranked


def rank_jobs(jobs: Iterable[dict], preferences: RankingPreferences | None = None) -> tuple[list[dict], dict]:
    ranked = [rank_job(job, preferences) for job in jobs]
    ranked.sort(key=lambda job: (
        -(job.get("rankingScore") or 0),
        -_clamp(job.get("fitScore") or job.get("matchScore")),
        str(job.get("id") or job.get("canonicalUrl") or job.get("title") or ""),
    ))

    reason_counts = Counter(
        reason["code"]
        for job in ranked
        for reason in job.get("rankingReasons", [])
    )
    component_averages = {
        name: round(fmean(job["rankingComponents"][name] for job in ranked), 1)
        for name in WEIGHTS
    } if ranked else {name: 0 for name in WEIGHTS}
    telemetry = {
        "ranking_version": RANKING_VERSION,
        "candidates_ranked": len(ranked),
        "component_averages": component_averages,
        "reason_counts": dict(reason_counts),
        "preferences": asdict(preferences or RankingPreferences()),
    }
    return ranked, telemetry
