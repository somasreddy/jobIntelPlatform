import asyncio

from api.match_intelligence import WorkspaceRequest, evaluate_workspace
from services.source_health import source_health_snapshot


def test_workspace_adapter_exposes_hard_gaps_and_source_trust():
    result = asyncio.run(evaluate_workspace(WorkspaceRequest(
        profile={"name": "A", "currentRole": "Backend Engineer", "skills": ["Python"], "experienceYears": 4},
        job={
            "title": "Backend Engineer",
            "technologies": ["Python", "Kubernetes"],
            "description": "Build Python services on Kubernetes.",
            "source": "Greenhouse",
            "postedDate": "2026-07-20",
            "verificationStatus": "VERIFIED",
            "applicationLink": "https://example.test/job",
        },
    )))
    assert result["decision"]["eligible"] is False
    assert result["decision"]["unmet_hard_requirement_ids"] == ["technology-1"]
    assert result["source_reliability"]["source"] == "Greenhouse"
    assert result["scoring_version"].startswith("match-v2")


def test_search_seed_is_never_authoritative_job_truth():
    snapshot = source_health_snapshot()
    assert snapshot["policy"]["search_results_are_job_truth"] is False
    seed = next(source for source in snapshot["sources"] if source["id"] == "search-seed")
    assert seed["priority"] < 20
    assert seed["status"] == "assist_only"

def test_discovery_never_promotes_search_snippets(monkeypatch):
    from job_discovery import connectors_v3, service_v2

    async def empty(*args, **kwargs):
        return []

    async def no_direct_jobs(*args, **kwargs):
        return [], []

    for name in (
        "_fetch_greenhouse", "_fetch_lever", "_fetch_ashby",
        "_fetch_workday", "_fetch_generic", "_fetch_wellfound",
    ):
        monkeypatch.setattr(connectors_v3, name, empty)
    for name in ("_fetch_remotive", "_fetch_arbeitnow", "_fetch_weworkremotely", "_fetch_authentic_jobs", "_fetch_hn_hiring"):
        monkeypatch.setattr(service_v2, name, empty)
    monkeypatch.setattr(service_v2, "discover_jobs_from_direct_boards", no_direct_jobs)

    service = service_v2.JobDiscoveryService()
    result = asyncio.run(service.discover_jobs("Backend Engineer", "Remote", run_verification=False))
    assert result == []
    assert service.last_google_urls
