from services.job_ranking import RankingPreferences, rank_job, rank_jobs


def _job(**overrides):
    value = {
        "id": "job-1",
        "title": "Platform Engineer",
        "location": "Berlin",
        "workMode": "Hybrid",
        "fitScore": 80,
        "sourceQuality": "high",
        "extractionConfidence": 90,
        "freshnessScore": 90,
        "verificationStatus": "VERIFIED",
        "salaryMin": 100000,
        "salaryMax": 130000,
    }
    value.update(overrides)
    return value


def test_ranking_is_deterministic_and_explainable():
    first = rank_job(_job())
    second = rank_job(_job())
    assert first == second
    assert first["rankingVersion"] == "job-rank-v1.0.0"
    assert set(first["rankingComponents"]) == {
        "match", "trust", "freshness", "preferences", "salary_quality", "verification"
    }
    assert all(reason["code"] and reason["label"] for reason in first["rankingReasons"])


def test_preferences_and_role_synonyms_affect_score():
    preferences = RankingPreferences(
        target_role="DevOps",
        work_mode="Remote",
        locations=("Germany",),
        minimum_salary=120000,
    )
    aligned = rank_job(_job(
        title="Site Reliability Engineer",
        workMode="Remote",
        location="Remote - Germany",
        salaryMax=140000,
    ), preferences)
    missed = rank_job(_job(
        title="Account Executive",
        workMode="On-site",
        location="Madrid",
        salaryMax=90000,
    ), preferences)
    assert aligned["rankingComponents"]["preferences"] > missed["rankingComponents"]["preferences"]
    assert aligned["rankingScore"] > missed["rankingScore"]


def test_trust_freshness_and_verification_change_order():
    trusted = _job(id="trusted")
    risky = _job(
        id="risky",
        sourceQuality="low",
        extractionConfidence=30,
        freshnessScore=15,
        verificationStatus="UNVERIFIED",
        salaryMin=None,
        salaryMax=None,
    )
    ranked, telemetry = rank_jobs([risky, trusted])
    assert [job["id"] for job in ranked] == ["trusted", "risky"]
    assert telemetry["candidates_ranked"] == 2
    assert telemetry["reason_counts"]["verification_verified"] == 1


def test_ties_have_stable_identifier_order():
    ranked, _ = rank_jobs([_job(id="b"), _job(id="a")])
    assert [job["id"] for job in ranked] == ["a", "b"]
