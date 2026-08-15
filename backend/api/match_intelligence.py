"""Versioned Match Intelligence API."""
from __future__ import annotations

import re
import logging
import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import get_current_user_id
from core.database import get_db
from models.database import CandidateProfile, MatchAssessment, MatchPolicy, OutboxEvent, VerifiedJob
from services.match_intelligence import ProfileEvidence, Requirement, compute_match_intelligence

router = APIRouter(dependencies=[Depends(get_current_user_id)])
logger = logging.getLogger(__name__)
_SYNONYMS = {"js": "javascript", "nodejs": "node.js", "node": "node.js", "ts": "typescript", "postgres": "postgresql", "k8s": "kubernetes", "reactjs": "react", "py": "python", "golang": "go"}


def _taxonomy_id(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9+#.]+", " ", value.lower()).strip()
    normalized = _SYNONYMS.get(normalized, normalized)
    return f"skill:{normalized.replace(' ', '-')}"


class RequirementInput(BaseModel):
    id: str
    label: str
    kind: Literal["hard", "preferred"] = "hard"
    taxonomy_id: str | None = None
    minimum_years: float | None = Field(default=None, ge=0, le=60)


class EvidenceInput(BaseModel):
    label: str
    taxonomy_id: str | None = None
    years: float | None = Field(default=None, ge=0, le=60)
    last_used_year: int | None = None
    evidence_refs: list[str] = []
    inferred: bool = False


class EvaluateRequest(BaseModel):
    requirements: list[RequirementInput]
    profile_evidence: list[EvidenceInput]
    role_relevance: float = Field(default=.5, ge=0, le=1)
    trajectory_alignment: float = Field(default=.5, ge=0, le=1)
    market_competitiveness: float = Field(default=.5, ge=0, le=1)
    profile_completeness: float = Field(default=.5, ge=0, le=1)
    extraction_quality: float = Field(default=.5, ge=0, le=1)
    provenance_coverage: float = Field(default=.5, ge=0, le=1)


class WorkspaceRequest(BaseModel):
    profile: dict[str, Any] = {}
    job: dict[str, Any] = {}


def _tokens(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9+#.]+", (value or "").lower()))


@router.post("/evaluate")
async def evaluate(payload: EvaluateRequest) -> dict:
    return compute_match_intelligence(
        requirements=[Requirement(item.id, item.label, item.kind, item.taxonomy_id or _taxonomy_id(item.label), item.minimum_years) for item in payload.requirements],
        profile_evidence=[ProfileEvidence(item.taxonomy_id or _taxonomy_id(item.label), item.label, item.years, item.last_used_year, tuple(item.evidence_refs), item.inferred) for item in payload.profile_evidence],
        role_relevance=payload.role_relevance,
        trajectory_alignment=payload.trajectory_alignment,
        market_competitiveness=payload.market_competitiveness,
        profile_completeness=payload.profile_completeness,
        extraction_quality=payload.extraction_quality,
        provenance_coverage=payload.provenance_coverage,
    )


@router.post("/workspace")
async def evaluate_workspace(
    payload: WorkspaceRequest,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
) -> dict:
    """Conservative adapter for the current frontend profile/job shapes."""
    profile, job = payload.profile, payload.job
    technologies = [str(v) for v in (job.get("technologies") or []) if str(v).strip()]
    requirements = [Requirement(f"technology-{i}", value, "hard", _taxonomy_id(value)) for i, value in enumerate(technologies)]
    for index, raw in enumerate(job.get("requirements") or []):
        label = str(raw.get("label") if isinstance(raw, dict) else raw).strip()
        if label:
            kind = "preferred" if re.search(r"\b(preferred|nice to have|bonus)\b", label, re.I) else "hard"
            requirements.append(Requirement(f"requirement-{index}", label, kind, _taxonomy_id(label)))

    evidence: list[ProfileEvidence] = []
    seen: set[str] = set()
    for field_name in ["skills", "frameworks", "languages", "cicdTools", "cicd_tools", "aiTools", "ai_tools", "certifications"]:
        for value in profile.get(field_name) or []:
            label = str(value).strip()
            taxonomy_id = _taxonomy_id(label)
            if not label or taxonomy_id in seen:
                continue
            seen.add(taxonomy_id)
            evidence.append(ProfileEvidence(taxonomy_id, label, float(profile.get("experienceYears") or profile.get("experience_years") or 0) or None, None, (f"profile.{field_name}",), False))

    target_role = str(profile.get("currentRole") or profile.get("current_role") or "")
    target_tokens, title_tokens = _tokens(target_role), _tokens(str(job.get("title") or ""))
    completed = sum(bool(profile.get(field)) for field in ("name", "currentRole", "currentLocation", "workMode", "resumeText")) + min(3, len(evidence))
    description = str(job.get("description") or "")
    result = compute_match_intelligence(
        requirements=requirements,
        profile_evidence=evidence,
        role_relevance=len(target_tokens & title_tokens) / max(1, len(title_tokens)),
        trajectory_alignment=.8 if target_tokens & title_tokens else .45,
        market_competitiveness=min(1, .35 + len(evidence) / 20),
        profile_completeness=min(1, completed / 8),
        extraction_quality=min(1, .35 + len(technologies) * .08 + min(len(description), 1500) / 3000),
        provenance_coverage=min(1, sum(bool(job.get(field)) for field in ("source", "postedDate", "verificationStatus", "applicationLink")) / 4),
    )
    result["source_reliability"] = {
        "status": job.get("verificationStatus") or "UNVERIFIED",
        "source": job.get("source") or "Unknown",
        "last_verified": job.get("lastVerifiedAt"),
        "freshness_score": job.get("freshnessScore"),
    }
    result["assessment_persistence"] = "not_applicable"
    try:
        job_id = uuid.UUID(str(job.get("id") or ""))
    except ValueError:
        job_id = None
    if job_id is not None:
        try:
            job_record = (await db.execute(select(VerifiedJob).where(VerifiedJob.id == job_id))).scalar_one_or_none()
            if job_record is None:
                result["assessment_persistence"] = "job_not_found"
            else:
                profile_record = (await db.execute(
                    select(CandidateProfile).where(CandidateProfile.user_id == user_id)
                )).scalar_one_or_none()
                policy = (await db.execute(
                    select(MatchPolicy)
                    .where(MatchPolicy.status == "active")
                    .order_by(MatchPolicy.activated_at.desc())
                    .limit(1)
                )).scalar_one_or_none()
                assessment = MatchAssessment(
                    user_id=user_id,
                    job_id=job_id,
                    profile_snapshot_id=profile_record.id if profile_record else None,
                    scoring_version=result["scoring_version"],
                    policy_id=policy.id if policy else None,
                    overall_score=result["overall_score"],
                    eligibility_score=result["scores"]["eligibility"],
                    relevance_score=result["scores"]["relevance"],
                    competitiveness_score=result["scores"]["competitiveness"],
                    completeness_score=result["scores"]["profile_completeness"],
                    confidence_score=result["scores"]["confidence"],
                    fit_label=result["fit_label"],
                    reason_trace=result["reason_trace"],
                    input_snapshot={
                        "requirements": [item.__dict__ for item in requirements],
                        "profile_evidence": [item.__dict__ for item in evidence],
                    },
                )
                db.add(assessment)
                await db.flush()
                db.add(OutboxEvent(
                    aggregate_type="match_assessment",
                    aggregate_id=str(assessment.id),
                    event_type="match.completed",
                    event_version=1,
                    payload={
                        "assessment_id": str(assessment.id),
                        "job_id": str(job_id),
                        "user_id": str(user_id),
                        "overall_score": result["overall_score"],
                        "confidence_score": result["scores"]["confidence"],
                        "scoring_version": result["scoring_version"],
                    },
                ))
                await db.flush()
                result["assessment_id"] = str(assessment.id)
                result["assessment_persistence"] = "persisted"
        except Exception as exc:
            await db.rollback()
            logger.warning("Match assessment persistence unavailable: %s", exc)
            result["assessment_persistence"] = "unavailable"
    return result
