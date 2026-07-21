from services.match_intelligence import (
    MatchPolicy,
    ProfileEvidence,
    Requirement,
    compute_match_intelligence,
)


def test_unmet_hard_requirement_blocks_recommendation():
    result = compute_match_intelligence(
        requirements=[Requirement("r1", "Python", "hard", "skill:python", 3)],
        profile_evidence=[],
        role_relevance=1,
        trajectory_alignment=1,
        market_competitiveness=1,
        profile_completeness=1,
        extraction_quality=1,
        provenance_coverage=1,
    )
    assert result["fit_label"] == "Not eligible"
    assert result["decision"]["eligible"] is False
    assert result["decision"]["recommendation_allowed"] is False
    assert result["reason_trace"][0]["status"] == "unmet"


def test_inferred_evidence_is_visible_and_discounted():
    result = compute_match_intelligence(
        requirements=[Requirement("r1", "Python", "hard", "skill:python")],
        profile_evidence=[ProfileEvidence("skill:python", "Python project", inferred=True)],
        role_relevance=.8,
        trajectory_alignment=.8,
        market_competitiveness=.8,
        profile_completeness=.8,
        extraction_quality=.9,
        provenance_coverage=.9,
    )
    trace = result["reason_trace"][0]
    assert trace["status"] == "partial"
    assert trace["needs_review"] is True
    assert trace["credit"] == .65
    assert result["assumptions"]


def test_low_confidence_never_masquerades_as_recommendation():
    result = compute_match_intelligence(
        requirements=[],
        profile_evidence=[],
        role_relevance=1,
        trajectory_alignment=1,
        market_competitiveness=1,
        profile_completeness=1,
        extraction_quality=.2,
        provenance_coverage=.2,
    )
    assert result["overall_score"] == 100
    assert result["fit_label"] == "Needs review"
    assert result["decision"]["recommendation_allowed"] is False


def test_policy_weights_must_sum_to_one():
    bad_policy = MatchPolicy(weights={
        "eligibility": .5,
        "relevance": .5,
        "competitiveness": .5,
        "profile_completeness": .5,
    })
    try:
        bad_policy.validate()
    except ValueError as exc:
        assert "sum" in str(exc)
    else:
        raise AssertionError("invalid policy accepted")
