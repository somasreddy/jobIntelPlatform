"""
Tests for the job fit-score calculator in services/fit_score.py.

`compute_fit_score` is documented as "a pure function - no DB calls", which
makes it ideal for unit testing: no client, no database, no LLM.
"""
from __future__ import annotations

from services.fit_score import compute_fit_score


def _base_kwargs(**overrides) -> dict:
    """A fully-specified, strong-match baseline; tests override just the
    dimension(s) they care about."""
    kwargs = dict(
        user_skills=["Python", "FastAPI"],
        user_frameworks=["React"],
        user_languages=["TypeScript"],
        user_experience_years=6,
        user_preferred_locations=["Berlin"],
        user_work_mode="Hybrid",
        user_current_salary=90_000,
        user_target_role="Senior Backend Engineer",
        user_target_salary_min=None,
        job_title="Senior Backend Engineer",
        job_description="We need Python and FastAPI experience, React is a plus.",
        job_requirements=["Python", "FastAPI", "TypeScript"],
        job_experience_required=5,
        job_location="Berlin",
        job_work_mode="Hybrid",
        job_salary_min=95_000,
        job_salary_max=110_000,
    )
    kwargs.update(overrides)
    return kwargs


def test_strong_all_around_match_scores_high_and_labels_excellent():
    result = compute_fit_score(**_base_kwargs())

    assert result["fit_score"] >= 85
    assert result["badge"] == "Excellent Fit"
    assert set(result["breakdown"].keys()) == {
        "skills_match", "seniority_match", "location_match", "salary_match", "title_match",
    }


def test_total_score_is_weighted_sum_of_dimension_scores():
    result = compute_fit_score(**_base_kwargs())
    breakdown = result["breakdown"]

    expected_total = int(sum(
        breakdown[dim]["score"] * breakdown[dim]["weight"] / 100
        for dim in breakdown
    ))
    assert result["fit_score"] == expected_total
    # Weights are documented percentages and must sum to 100.
    assert sum(dim["weight"] for dim in breakdown.values()) == 100


def test_no_user_skills_scores_zero_on_skills_dimension():
    result = compute_fit_score(**_base_kwargs(user_skills=[], user_frameworks=[], user_languages=[]))
    assert result["breakdown"]["skills_match"]["score"] == 0
    assert "no skills" in result["breakdown"]["skills_match"]["label"].lower()


def test_skills_partially_mentioned_in_job_description_only():
    # 1 of 2 skills appears in the job text -> 50% match.
    result = compute_fit_score(
        **_base_kwargs(
            user_skills=["Python", "Rust"],
            user_frameworks=[],
            user_languages=[],
            job_description="Looking for a strong Python engineer.",
            job_requirements=[],
        )
    )
    assert result["breakdown"]["skills_match"]["score"] == 50


def test_remote_job_scores_full_location_match_regardless_of_preference():
    result = compute_fit_score(
        **_base_kwargs(job_work_mode="Fully Remote", job_location="Anywhere")
    )
    assert result["breakdown"]["location_match"]["score"] == 100


def test_remote_preference_against_onsite_job_is_penalized():
    result = compute_fit_score(
        **_base_kwargs(
            user_work_mode="Remote",
            job_work_mode="On-site",
            job_location="Berlin",
        )
    )
    assert result["breakdown"]["location_match"]["score"] == 20


def test_underqualified_candidate_gets_experience_gap_penalty():
    result = compute_fit_score(
        **_base_kwargs(user_experience_years=1, job_experience_required=8)
    )
    seniority = result["breakdown"]["seniority_match"]
    assert seniority["score"] < 60
    assert "gap" in seniority["label"].lower()


def test_salary_below_target_reduces_score_but_not_below_zero():
    result = compute_fit_score(
        **_base_kwargs(
            user_target_salary_min=200_000,
            job_salary_min=50_000,
            job_salary_max=60_000,
        )
    )
    assert 0 <= result["breakdown"]["salary_match"]["score"] < 100
    assert "below target" in result["breakdown"]["salary_match"]["label"].lower()


def test_weak_match_across_all_dimensions_yields_weak_fit_badge():
    result = compute_fit_score(
        user_skills=["COBOL"],
        user_frameworks=[],
        user_languages=[],
        user_experience_years=1,
        user_preferred_locations=["Antarctica"],
        user_work_mode="Remote",
        user_current_salary=30_000,
        user_target_role="Ice Fisher",
        user_target_salary_min=None,
        job_title="Senior Backend Engineer",
        job_description="Python, FastAPI, Kubernetes required.",
        job_requirements=["Python", "FastAPI"],
        job_experience_required=10,
        job_location="Berlin",
        job_work_mode="On-site",
        job_salary_min=200_000,
        job_salary_max=250_000,
    )
    assert result["badge"] == "Weak Fit"
    assert result["fit_score"] < 40
