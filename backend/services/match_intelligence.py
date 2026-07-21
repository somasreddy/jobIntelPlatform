"""Deterministic, explainable Match Intelligence 2.0 core.

The engine deliberately accepts normalized facts rather than raw resume/JD text.
Extraction (including optional LLM enrichment) happens upstream; this module is
pure, versioned, auditable, and safe to replay.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal, Mapping, Sequence


SCORING_VERSION = "match-v2.0.0"
RequirementKind = Literal["hard", "preferred"]
EvidenceStrength = Literal["explicit", "inferred", "missing"]


@dataclass(frozen=True)
class Requirement:
    id: str
    label: str
    kind: RequirementKind
    taxonomy_id: str | None = None
    minimum_years: float | None = None


@dataclass(frozen=True)
class ProfileEvidence:
    taxonomy_id: str
    label: str
    years: float | None = None
    last_used_year: int | None = None
    evidence_refs: tuple[str, ...] = ()
    inferred: bool = False


@dataclass(frozen=True)
class MatchPolicy:
    id: str = "default"
    version: str = "1.0.0"
    weights: Mapping[str, float] = field(default_factory=lambda: {
        "eligibility": 0.35,
        "relevance": 0.30,
        "competitiveness": 0.20,
        "profile_completeness": 0.15,
    })
    hard_requirement_penalty: float = 18.0
    inferred_evidence_credit: float = 0.65
    minimum_confidence_for_recommendation: float = 0.60

    def validate(self) -> None:
        required = {"eligibility", "relevance", "competitiveness", "profile_completeness"}
        if set(self.weights) != required:
            raise ValueError(f"weights must contain exactly {sorted(required)}")
        if abs(sum(self.weights.values()) - 1.0) > 1e-9:
            raise ValueError("weights must sum to 1.0")
        if any(weight < 0 for weight in self.weights.values()):
            raise ValueError("weights cannot be negative")


def _clamp(value: float) -> int:
    return round(max(0.0, min(100.0, value)))


def _requirement_trace(
    requirement: Requirement,
    evidence_by_taxonomy: Mapping[str, ProfileEvidence],
    policy: MatchPolicy,
) -> dict:
    evidence = evidence_by_taxonomy.get(requirement.taxonomy_id or "")
    if evidence is None:
        return {
            "requirement_id": requirement.id,
            "requirement": requirement.label,
            "kind": requirement.kind,
            "status": "unmet",
            "strength": "missing",
            "credit": 0.0,
            "evidence_refs": [],
            "reason": "No normalized profile evidence supports this requirement.",
            "needs_review": False,
        }

    years_ok = requirement.minimum_years is None or (
        evidence.years is not None and evidence.years >= requirement.minimum_years
    )
    credit = policy.inferred_evidence_credit if evidence.inferred else 1.0
    if not years_ok:
        credit *= 0.5
    strength: EvidenceStrength = "inferred" if evidence.inferred else "explicit"
    status = "met" if years_ok and not evidence.inferred else "partial"
    reason = f"Supported by {evidence.label}"
    if requirement.minimum_years is not None:
        reason += f" ({evidence.years or 0:g}/{requirement.minimum_years:g} years evidenced)"
    return {
        "requirement_id": requirement.id,
        "requirement": requirement.label,
        "kind": requirement.kind,
        "status": status,
        "strength": strength,
        "credit": round(credit, 3),
        "evidence_refs": list(evidence.evidence_refs),
        "reason": reason + ".",
        "needs_review": evidence.inferred,
    }


def compute_match_intelligence(
    *,
    requirements: Sequence[Requirement],
    profile_evidence: Sequence[ProfileEvidence],
    role_relevance: float,
    trajectory_alignment: float,
    market_competitiveness: float,
    profile_completeness: float,
    extraction_quality: float,
    provenance_coverage: float,
    policy: MatchPolicy | None = None,
) -> dict:
    """Return a complete scorecard and immutable reason trace.

    All float inputs use a 0..1 scale. The overall score excludes confidence:
    confidence qualifies the result instead of disguising missing data as fit.
    """
    policy = policy or MatchPolicy()
    policy.validate()
    evidence_by_taxonomy = {item.taxonomy_id: item for item in profile_evidence}
    traces = [_requirement_trace(req, evidence_by_taxonomy, policy) for req in requirements]
    hard = [trace for trace in traces if trace["kind"] == "hard"]
    preferred = [trace for trace in traces if trace["kind"] == "preferred"]

    hard_credit = sum(item["credit"] for item in hard) / len(hard) if hard else 1.0
    preferred_credit = sum(item["credit"] for item in preferred) / len(preferred) if preferred else 1.0
    unmet_hard = [item for item in hard if item["status"] == "unmet"]

    eligibility = _clamp(hard_credit * 100 - len(unmet_hard) * policy.hard_requirement_penalty)
    relevance = _clamp((preferred_credit * 0.55 + max(0, min(1, role_relevance)) * 0.45) * 100)
    competitiveness = _clamp(
        (max(0, min(1, market_competitiveness)) * 0.7 + max(0, min(1, trajectory_alignment)) * 0.3) * 100
    )
    completeness = _clamp(max(0, min(1, profile_completeness)) * 100)
    confidence = _clamp((max(0, min(1, extraction_quality)) * 0.55 + max(0, min(1, provenance_coverage)) * 0.45) * 100)

    dimensions = {
        "eligibility": eligibility,
        "relevance": relevance,
        "competitiveness": competitiveness,
        "profile_completeness": completeness,
    }
    overall = _clamp(sum(dimensions[name] * weight for name, weight in policy.weights.items()))
    if unmet_hard:
        fit_label = "Not eligible"
    elif confidence < policy.minimum_confidence_for_recommendation * 100:
        fit_label = "Needs review"
    elif overall >= 85:
        fit_label = "Excellent fit"
    elif overall >= 70:
        fit_label = "Strong fit"
    elif overall >= 55:
        fit_label = "Potential fit"
    else:
        fit_label = "Low fit"

    return {
        "scoring_version": SCORING_VERSION,
        "policy": {"id": policy.id, "version": policy.version, "weights": dict(policy.weights)},
        "overall_score": overall,
        "fit_label": fit_label,
        "scores": {**dimensions, "confidence": confidence},
        "decision": {
            "eligible": not unmet_hard,
            "recommendation_allowed": not unmet_hard and confidence >= policy.minimum_confidence_for_recommendation * 100,
            "unmet_hard_requirement_ids": [item["requirement_id"] for item in unmet_hard],
        },
        "reason_trace": traces,
        "assumptions": [item["reason"] for item in traces if item["needs_review"]],
        "inputs": {
            "requirements": [asdict(item) for item in requirements],
            "profile_evidence_count": len(profile_evidence),
        },
    }
