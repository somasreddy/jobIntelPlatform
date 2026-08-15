"""Reviewable Profile Intelligence facts, snapshots, and variants."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user_id
from core.database import get_db
from models.database import (
    AuditLog,
    CandidateProfile,
    ProfileFact,
    ProfileSnapshot,
    ProfileVariant,
)
from services.profile_intelligence import (
    create_snapshot,
    evidence_coverage,
    fact_to_dict,
    normalize_fact_key,
    profile_data,
)

router = APIRouter()


class FactImportItem(BaseModel):
    fact_type: str = Field(min_length=1, max_length=80)
    value: dict[str, Any]
    normalized_key: str | None = None
    trust_state: Literal["explicit", "inferred", "needs_review"] = "inferred"
    source_type: str = Field(default="resume_parser", min_length=1, max_length=50)
    source_ref: str | None = None
    evidence: dict[str, Any] = Field(default_factory=dict)


class FactImportRequest(BaseModel):
    items: list[FactImportItem] = Field(max_length=500)


class FactReviewRequest(BaseModel):
    review_status: Literal["approved", "rejected"]
    corrected_value: dict[str, Any] | None = None


class SnapshotRequest(BaseModel):
    label: str = Field(default="Profile snapshot", min_length=1, max_length=255)
    kind: Literal["base", "target_role", "tailored"] = "base"


class VariantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    target_role: str | None = None
    target_company: str | None = None
    base_snapshot_id: str | None = None
    overrides: dict[str, Any] = Field(default_factory=dict)


class VariantUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    target_role: str | None = None
    target_company: str | None = None
    base_snapshot_id: str | None = None
    overrides: dict[str, Any] | None = None
    status: Literal["draft", "active", "archived"] | None = None


async def _profile(db: AsyncSession, user_id: uuid.UUID) -> CandidateProfile:
    result = await db.execute(
        select(CandidateProfile).where(CandidateProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


def _snapshot_dict(item: ProfileSnapshot) -> dict:
    return {
        "id": str(item.id),
        "label": item.label,
        "kind": item.kind,
        "version": item.version,
        "profile_data": item.profile_data,
        "facts": item.facts or [],
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


def _variant_dict(item: ProfileVariant) -> dict:
    return {
        "id": str(item.id),
        "name": item.name,
        "target_role": item.target_role,
        "target_company": item.target_company,
        "base_snapshot_id": str(item.base_snapshot_id) if item.base_snapshot_id else None,
        "overrides": item.overrides or {},
        "status": item.status,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


@router.get("")
async def get_profile_intelligence(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    profile = await _profile(db, user_id)
    facts_result = await db.execute(
        select(ProfileFact)
        .where(ProfileFact.profile_id == profile.id)
        .order_by(ProfileFact.fact_type, ProfileFact.normalized_key)
    )
    facts = list(facts_result.scalars().all())
    snapshots_result = await db.execute(
        select(ProfileSnapshot)
        .where(ProfileSnapshot.profile_id == profile.id)
        .order_by(ProfileSnapshot.version.desc())
        .limit(20)
    )
    variants_result = await db.execute(
        select(ProfileVariant)
        .where(ProfileVariant.profile_id == profile.id)
        .order_by(ProfileVariant.updated_at.desc())
    )
    return {
        "profile": profile_data(profile),
        "coverage": evidence_coverage(facts),
        "facts": [fact_to_dict(item) for item in facts],
        "snapshots": [_snapshot_dict(item) for item in snapshots_result.scalars().all()],
        "variants": [_variant_dict(item) for item in variants_result.scalars().all()],
    }


@router.post("/facts/import", status_code=201)
async def import_profile_facts(
    payload: FactImportRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    profile = await _profile(db, user_id)
    imported: list[ProfileFact] = []
    for item in payload.items:
        label = item.value.get("label") or item.value.get("value") or item.fact_type
        normalized_key = normalize_fact_key(item.normalized_key or label)
        if not normalized_key:
            raise HTTPException(status_code=400, detail="Fact normalized_key cannot be empty")
        result = await db.execute(
            select(ProfileFact).where(
                ProfileFact.profile_id == profile.id,
                ProfileFact.source_type == item.source_type,
                ProfileFact.fact_type == item.fact_type,
                ProfileFact.normalized_key == normalized_key,
            )
        )
        fact = result.scalar_one_or_none()
        if fact:
            fact.value = item.value
            fact.trust_state = item.trust_state
            fact.source_ref = item.source_ref
            fact.evidence = item.evidence
            fact.review_status = "pending" if item.trust_state != "explicit" else "approved"
        else:
            fact = ProfileFact(
                user_id=user_id,
                profile_id=profile.id,
                fact_type=item.fact_type,
                normalized_key=normalized_key,
                value=item.value,
                trust_state=item.trust_state,
                source_type=item.source_type,
                source_ref=item.source_ref,
                evidence=item.evidence,
                review_status="pending" if item.trust_state != "explicit" else "approved",
                reviewed_by=user_id if item.trust_state == "explicit" else None,
                reviewed_at=datetime.now(timezone.utc) if item.trust_state == "explicit" else None,
            )
            db.add(fact)
        imported.append(fact)
    await db.flush()
    return {"imported": len(imported), "facts": [fact_to_dict(item) for item in imported]}


@router.patch("/facts/{fact_id}")
async def review_profile_fact(
    fact_id: str,
    payload: FactReviewRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        fact_uuid = uuid.UUID(fact_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid fact ID")
    result = await db.execute(
        select(ProfileFact).where(ProfileFact.id == fact_uuid, ProfileFact.user_id == user_id)
    )
    fact = result.scalar_one_or_none()
    if not fact:
        raise HTTPException(status_code=404, detail="Profile fact not found")
    before = fact_to_dict(fact)
    fact.review_status = payload.review_status
    fact.reviewed_by = user_id
    fact.reviewed_at = datetime.now(timezone.utc)
    if payload.corrected_value is not None:
        fact.value = payload.corrected_value
        fact.trust_state = "explicit"
        fact.normalized_key = normalize_fact_key(
            payload.corrected_value.get("label")
            or payload.corrected_value.get("value")
            or fact.normalized_key
        )
    db.add(AuditLog(
        actor_id=user_id,
        actor_type="user",
        action=f"profile_fact.{payload.review_status}",
        resource_type="profile_fact",
        resource_id=str(fact.id),
        before_state=before,
        after_state=fact_to_dict(fact),
        audit_metadata={"source": "profile_intelligence_review"},
    ))
    await db.flush()
    return fact_to_dict(fact)


@router.post("/snapshots", status_code=201)
async def capture_profile_snapshot(
    payload: SnapshotRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    profile = await _profile(db, user_id)
    snapshot = await create_snapshot(
        db, profile, user_id, label=payload.label, kind=payload.kind
    )
    return _snapshot_dict(snapshot)


@router.post("/variants", status_code=201)
async def create_profile_variant(
    payload: VariantCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    profile = await _profile(db, user_id)
    snapshot_id = None
    if payload.base_snapshot_id:
        try:
            snapshot_id = uuid.UUID(payload.base_snapshot_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid base snapshot ID")
        owned = await db.execute(
            select(ProfileSnapshot.id).where(
                ProfileSnapshot.id == snapshot_id,
                ProfileSnapshot.user_id == user_id,
            )
        )
        if owned.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Base snapshot not found")
    variant = ProfileVariant(
        user_id=user_id,
        profile_id=profile.id,
        name=payload.name,
        target_role=payload.target_role,
        target_company=payload.target_company,
        base_snapshot_id=snapshot_id,
        overrides=payload.overrides,
        status="draft",
    )
    db.add(variant)
    await db.flush()
    return _variant_dict(variant)


@router.patch("/variants/{variant_id}")
async def update_profile_variant(
    variant_id: str,
    payload: VariantUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        item_id = uuid.UUID(variant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid variant ID")
    result = await db.execute(
        select(ProfileVariant).where(
            ProfileVariant.id == item_id,
            ProfileVariant.user_id == user_id,
        )
    )
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="Profile variant not found")
    data = payload.model_dump(exclude_none=True, exclude={"base_snapshot_id"})
    for key, value in data.items():
        setattr(variant, key, value)
    if payload.base_snapshot_id is not None:
        try:
            variant.base_snapshot_id = uuid.UUID(payload.base_snapshot_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid base snapshot ID")
    await db.flush()
    return _variant_dict(variant)
