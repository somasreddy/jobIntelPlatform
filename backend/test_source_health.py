from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from services.source_health import source_health_snapshot_from_records


def test_persisted_source_health_uses_latest_run_and_search_seed_policy():
    source_id = uuid4()
    source = SimpleNamespace(
        id=source_id,
        name="Search expansion",
        source_type="search_seed",
        base_url="https://search.test",
        priority=10,
        parser_name="seed",
        parser_version="v1",
        crawl_frequency_minutes=1440,
        health_score=70,
        failure_rate=8,
        enabled=True,
        last_success_at=None,
        last_failure_at=None,
        updated_at=datetime.now(timezone.utc),
    )
    run = SimpleNamespace(
        id=uuid4(),
        source_id=source_id,
        status="completed",
        parser_version="v1",
        correlation_id=uuid4(),
        counters={"candidates": 3, "jobs": 0},
        error_code=None,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
    )

    snapshot = source_health_snapshot_from_records([source], [run])

    assert snapshot["persistence"] == "database"
    assert snapshot["policy"]["search_results_are_job_truth"] is False
    assert snapshot["sources"][0]["status"] == "assist_only"
    assert snapshot["sources"][0]["latest_run"]["counters"]["jobs"] == 0
