from datetime import datetime, timezone

from api.jobs import _row_to_dict
from models.database import VerifiedJob


def _job(**overrides):
    values = {
        "title": "Platform Engineer",
        "organization": "Acme",
        "location": "Remote",
        "work_mode": "Remote",
        "currency": "USD",
        "technologies": ["Kubernetes"],
        "application_link": "https://jobs.test/1",
        "verification_status": "VERIFIED",
        "level_up": False,
        "created_at": datetime.now(timezone.utc),
    }
    values.update(overrides)
    job = VerifiedJob(**values)
    job.id = job.id or __import__("uuid").uuid4()
    return job


def test_verified_job_projects_high_source_quality_and_confidence():
    projected = _row_to_dict(_job())
    assert projected["sourceQuality"] == "high"
    assert projected["extractionConfidence"] >= 90
    assert projected["freshnessStatus"] == "fresh"


def test_unverified_job_does_not_receive_high_trust_defaults():
    projected = _row_to_dict(_job(verification_status="UNVERIFIED", application_link=None))
    assert projected["sourceQuality"] == "low"
    assert projected["extractionConfidence"] < 60
