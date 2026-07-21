from datetime import datetime, timezone

from job_discovery.pipeline import (
    RetryPolicy,
    canonical_fingerprint,
    canonicalize_url,
    deduplicate_jobs,
    freshness_score,
    normalize_job,
)


def test_canonical_url_removes_tracking_and_sorts_query():
    value = canonicalize_url("HTTPS://Jobs.Example.com/opening/123/?utm_source=x&b=2&a=1#apply")
    assert value == "https://jobs.example.com/opening/123?a=1&b=2"


def test_deduplication_prefers_url_then_requisition_then_fingerprint():
    base = {"title": "Backend Engineer", "organization": "Acme", "location": "Remote"}
    jobs = [
        normalize_job({**base, "application_link": "https://jobs.test/1?utm_source=x", "source": "Lever"}),
        normalize_job({**base, "application_link": "https://jobs.test/1", "source": "Lever"}),
        normalize_job({**base, "application_link": "https://jobs.test/2", "source": "Lever"}),
    ]
    assert len(deduplicate_jobs(jobs)) == 1


def test_fingerprint_is_stable_across_case_and_punctuation():
    first = canonical_fingerprint({"title": "Senior QA Engineer", "organization": "A.C.M.E.", "location": "Dublin, IE"})
    second = canonical_fingerprint({"title": "senior qa engineer", "organization": "a c m e", "location": "dublin ie"})
    assert first == second


def test_freshness_separates_verified_and_unverified_unknown_dates():
    now = datetime(2026, 7, 20, tzinfo=timezone.utc)
    assert freshness_score({"posted_date": "2026-07-20", "verification_status": "VERIFIED"}, now) == 100
    assert freshness_score({"verification_status": "UNVERIFIED"}, now) == 20


def test_retry_policy_honors_retry_after_and_stops():
    policy = RetryPolicy()
    assert policy.delay_for_attempt(0) == 60
    assert policy.delay_for_attempt(1, retry_after=17) == 17
    assert policy.delay_for_attempt(99) is None
