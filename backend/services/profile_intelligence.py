"""Persistence helpers for normalized, reviewable profile evidence."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import CandidateProfile, ProfileFact, ProfileSnapshot


SCALAR_FACTS = {
    "name": "identity",
    "current_role": "role",
    "experience_years": "experience",
    "current_location": "location",
    "work_mode": "work_preference",
    "current_salary": "compensation",
}
LIST_FACTS = {
    "preferred_locations": "preferred_location",
    "skills": "skill",
    "frameworks": "framework",
    "languages": "language",
    "cicd_tools": "cicd_tool",
    "ai_tools": "ai_tool",
    "certifications": "certification",
}


def normalize_fact_key(value: object) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower())).strip("_")


def profile_data(profile: CandidateProfile) -> dict:
    return {
        "name": profile.name,
        "current_role": profile.current_role,
        "current_salary": profile.current_salary,
        "currency": profile.currency,
        "experience_years": profile.experience_years,
        "current_location": profile.current_location,
        "preferred_locations": profile.preferred_locations or [],
        "skills": profile.skills or [],
        "frameworks": profile.frameworks or [],
        "languages": profile.languages or [],
        "cicd_tools": profile.cicd_tools or [],
        "ai_tools": profile.ai_tools or [],
        "certifications": profile.certifications or [],
        "work_mode": profile.work_mode,
        "base_resume_text": profile.base_resume_text,
    }


def profile_fact_specs(profile: CandidateProfile) -> list[dict]:
    specs: list[dict] = []
    for field, fact_type in SCALAR_FACTS.items():
        value = getattr(profile, field, None)
        if value in (None, "", 0):
            continue
        specs.append({
            "fact_type": fact_type,
            "normalized_key": field,
            "value": {"value": value, "field": field},
        })
    for field, fact_type in LIST_FACTS.items():
        seen: set[str] = set()
        for value in getattr(profile, field, None) or []:
            key = normalize_fact_key(value)
            if not key or key in seen:
                continue
            seen.add(key)
            specs.append({
                "fact_type": fact_type,
                "normalized_key": key,
                "value": {"label": str(value).strip(), "field": field},
            })
    return specs


def fact_to_dict(fact: ProfileFact) -> dict:
    return {
        "id": str(fact.id),
        "fact_type": fact.fact_type,
        "normalized_key": fact.normalized_key,
        "value": fact.value,
        "trust_state": fact.trust_state,
        "source_type": fact.source_type,
        "source_ref": fact.source_ref,
        "evidence": fact.evidence or {},
        "review_status": fact.review_status,
        "reviewed_by": str(fact.reviewed_by) if fact.reviewed_by else None,
        "reviewed_at": fact.reviewed_at.isoformat() if fact.reviewed_at else None,
        "created_at": fact.created_at.isoformat() if fact.created_at else None,
    }


async def sync_explicit_profile_facts(
    db: AsyncSession,
    profile: CandidateProfile,
    user_id: uuid.UUID,
) -> list[ProfileFact]:
    result = await db.execute(
        select(ProfileFact).where(
            ProfileFact.profile_id == profile.id,
            ProfileFact.source_type == "profile_editor",
        )
    )
    existing = {
        (item.fact_type, item.normalized_key): item
        for item in result.scalars().all()
    }
    desired = profile_fact_specs(profile)
    desired_keys = {(item["fact_type"], item["normalized_key"]) for item in desired}

    for spec in desired:
        key = (spec["fact_type"], spec["normalized_key"])
        fact = existing.get(key)
        if fact:
            fact.value = spec["value"]
            fact.trust_state = "explicit"
            fact.review_status = "approved"
            fact.reviewed_by = user_id
            fact.reviewed_at = datetime.now(timezone.utc)
        else:
            fact = ProfileFact(
                user_id=user_id,
                profile_id=profile.id,
                **spec,
                trust_state="explicit",
                source_type="profile_editor",
                evidence={"origin": "user_saved_profile"},
                review_status="approved",
                reviewed_by=user_id,
                reviewed_at=datetime.now(timezone.utc),
            )
            db.add(fact)

    for key, fact in existing.items():
        if key not in desired_keys:
            await db.delete(fact)
    await db.flush()

    refreshed = await db.execute(
        select(ProfileFact)
        .where(ProfileFact.profile_id == profile.id)
        .order_by(ProfileFact.fact_type, ProfileFact.normalized_key)
    )
    return list(refreshed.scalars().all())


async def create_snapshot(
    db: AsyncSession,
    profile: CandidateProfile,
    user_id: uuid.UUID,
    *,
    label: str,
    kind: str = "base",
) -> ProfileSnapshot:
    facts_result = await db.execute(
        select(ProfileFact).where(
            ProfileFact.profile_id == profile.id,
            ProfileFact.review_status != "rejected",
        )
    )
    facts = [fact_to_dict(item) for item in facts_result.scalars().all()]
    version_result = await db.execute(
        select(func.max(ProfileSnapshot.version)).where(ProfileSnapshot.profile_id == profile.id)
    )
    version = int(version_result.scalar_one_or_none() or 0) + 1
    snapshot = ProfileSnapshot(
        user_id=user_id,
        profile_id=profile.id,
        label=label,
        kind=kind,
        version=version,
        profile_data=profile_data(profile),
        facts=facts,
    )
    db.add(snapshot)
    await db.flush()
    return snapshot


def evidence_coverage(facts: list[ProfileFact]) -> dict:
    total = len(facts)
    approved = sum(1 for item in facts if item.review_status == "approved")
    inferred = sum(1 for item in facts if item.trust_state == "inferred")
    needs_review = sum(1 for item in facts if item.review_status == "pending")
    with_evidence = sum(1 for item in facts if item.evidence)
    return {
        "total_facts": total,
        "approved_facts": approved,
        "inferred_facts": inferred,
        "needs_review": needs_review,
        "evidence_coverage_pct": round(with_evidence / total * 100) if total else 0,
        "review_coverage_pct": round(approved / total * 100) if total else 0,
    }
