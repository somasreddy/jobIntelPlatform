"""
Tests for the real (non-LLM) ATS keyword-match calculator in
services/ats_match.py.

Like fit_score, this is a pure function with no DB/LLM/network calls, so it's
tested directly without any app/client fixtures.
"""
from __future__ import annotations

from services.ats_match import compute_ats_match, extract_job_keywords


def test_curated_tags_always_included_in_keyword_list():
    keywords = extract_job_keywords(
        job_description="We build things.",
        job_technologies=["Python", "FastAPI"],
        job_requirements=["Docker"],
    )
    assert "Python" in keywords
    assert "FastAPI" in keywords
    assert "Docker" in keywords


def test_full_overlap_scores_100_percent():
    # job_description deliberately empty here: extract_job_keywords also pulls
    # frequent words out of free-text descriptions (tested separately below),
    # so a non-empty description could add extra keywords beyond the curated
    # tags and make this scenario no longer a "full overlap" case.
    result = compute_ats_match(
        resume_text="Experienced with Python, FastAPI, and Docker in production.",
        job_description="",
        job_technologies=["Python", "FastAPI", "Docker"],
    )
    assert result["match_pct"] == 100
    assert set(result["matched_keywords"]) == {"Python", "FastAPI", "Docker"}
    assert result["missing_keywords"] == []
    assert result["source"] == "computed"


def test_partial_overlap_reports_matched_and_missing():
    result = compute_ats_match(
        resume_text="I have used Python extensively.",
        job_description="",
        job_technologies=["Python", "Kubernetes"],
    )
    assert result["match_pct"] == 50
    assert result["matched_keywords"] == ["Python"]
    assert result["missing_keywords"] == ["Kubernetes"]


def test_empty_resume_text_yields_zero_percent_but_no_crash():
    result = compute_ats_match(
        resume_text="",
        job_description="",
        job_technologies=["Python", "Go"],
    )
    assert result["match_pct"] == 0
    assert result["matched_keywords"] == []
    assert set(result["missing_keywords"]) == {"Python", "Go"}


def test_no_keywords_at_all_yields_zero_percent_not_division_error():
    result = compute_ats_match(resume_text="Anything.", job_description="", job_technologies=[])
    assert result["match_pct"] == 0
    assert result["total_keywords"] == 0


def test_multiword_and_punctuated_keywords_use_substring_match():
    result = compute_ats_match(
        resume_text="Built CI/CD pipelines with Node.js and led Machine Learning projects.",
        job_description="",
        job_technologies=["CI/CD", "Node.js", "Machine Learning"],
    )
    assert result["match_pct"] == 100


def test_single_word_keyword_respects_word_boundaries():
    # "Go" must not match inside "going" / "algorithm".
    result = compute_ats_match(
        resume_text="Everything was going according to the algorithm.",
        job_description="",
        job_technologies=["Go"],
    )
    assert result["matched_keywords"] == []
    assert result["missing_keywords"] == ["Go"]


def test_stopwords_and_short_tokens_are_not_extracted_from_description():
    keywords = extract_job_keywords(
        job_description="We are the best team for you and your career and your future and your goals.",
        job_technologies=[],
        job_requirements=[],
    )
    assert "the" not in [k.lower() for k in keywords]
    assert "you" not in [k.lower() for k in keywords]


def test_description_keywords_are_frequency_ranked():
    keywords = extract_job_keywords(
        job_description="Kubernetes Kubernetes Kubernetes Terraform Terraform Ansible",
        job_technologies=[],
        job_requirements=[],
        max_extra_keywords=2,
    )
    assert keywords[0] == "kubernetes"
    assert "ansible" not in keywords  # least frequent, dropped by the cap
