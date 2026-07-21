import asyncio
from types import SimpleNamespace

import job_discovery.connectors_v3 as connectors_v3
import job_discovery.service_v2 as service_v2

from job_discovery.dork_discovery import _direct_board_search_urls
from job_discovery.source_registry import (
    load_search_catalog,
    resolve_source_plan,
    search_source_catalog,
)


class _ScalarRows:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _QueryResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _ScalarRows(self._rows)


class _FakeDatabase:
    def __init__(self, rows):
        self._rows = rows

    async def execute(self, _statement):
        return _QueryResult(self._rows)


def test_builtin_search_catalog_has_71_unique_sites_and_us_federal_sources():
    catalog = search_source_catalog()
    sites = [item["site"] for item in catalog]

    assert len(catalog) == 71
    assert len(set(sites)) == 71
    assert "site:usajobs.gov" in sites
    assert "site:dice.com" in sites


def test_persisted_catalog_is_authoritative_and_disabled_rows_stay_excluded():
    rows = [
        SimpleNamespace(
            id="custom-enabled",
            adapter_config={
                "site": "site:custom.example",
                "source_group": "job_board",
                "regions": ["GLOBAL"],
            },
            enabled=True,
        ),
        SimpleNamespace(
            id="indeed-disabled",
            adapter_config={
                "site": "site:indeed.com",
                "source_group": "job_board",
                "regions": ["GLOBAL"],
            },
            enabled=False,
        ),
        SimpleNamespace(
            id="greenhouse-disabled",
            adapter_config={
                "site": "site:greenhouse.io",
                "source_group": "ats",
                "regions": ["GLOBAL"],
            },
            enabled=False,
        ),
    ]

    catalog = asyncio.run(load_search_catalog(_FakeDatabase(rows)))
    plan = resolve_source_plan("Remote", source_catalog=catalog)

    assert len(catalog) == 3
    assert plan.job_boards == ("site:custom.example",)
    assert plan.ats_sites == ()
    assert plan.include_ats is False
    assert "site:indeed.com" not in plan.job_boards
    assert "site:greenhouse.io" not in plan.ats_sites
    assert "site:naukri.com" not in plan.job_boards


def test_global_direct_urls_are_balanced_across_regions_and_capped_at_24():
    urls = _direct_board_search_urls(
        "Senior Test Automation Engineer",
        ["Playwright", "Selenium"],
        "Remote",
    )
    joined = "\n".join(urls)

    assert len(urls) == 24
    assert "indeed.com/jobs" in joined
    assert "naukri.com" in joined
    assert "jobsireland.ie" in joined
    assert "usajobs.gov" in joined
    assert "jobstreet.com" in joined
    assert "mx.indeed.com" in joined


def test_us_direct_urls_include_usajobs_and_dice():
    urls = _direct_board_search_urls(
        "Senior Test Automation Engineer",
        ["Playwright"],
        "United States",
    )

    assert any("usajobs.gov" in url for url in urls)
    assert any("dice.com" in url for url in urls)


def test_service_v2_invokes_ashby_workday_and_generic_connectors(monkeypatch):
    calls = []

    async def empty_fetch(*_args, **_kwargs):
        return []

    async def empty_direct_fetch(**_kwargs):
        return [], []

    def tracked_fetch(name):
        async def fetch(*_args, **_kwargs):
            calls.append(name)
            return []

        return fetch

    monkeypatch.setattr(connectors_v3, "_fetch_greenhouse", empty_fetch)
    monkeypatch.setattr(connectors_v3, "_fetch_lever", empty_fetch)
    monkeypatch.setattr(connectors_v3, "_fetch_wellfound", empty_fetch)
    monkeypatch.setattr(connectors_v3, "_fetch_ashby", tracked_fetch("ashby"))
    monkeypatch.setattr(connectors_v3, "_fetch_workday", tracked_fetch("workday"))
    monkeypatch.setattr(connectors_v3, "_fetch_generic", tracked_fetch("generic"))

    for name in (
        "_fetch_remotive",
        "_fetch_arbeitnow",
        "_fetch_weworkremotely",
        "_fetch_authentic_jobs",
        "_fetch_hn_hiring",
    ):
        monkeypatch.setattr(service_v2, name, empty_fetch)
    monkeypatch.setattr(service_v2, "discover_jobs_from_direct_boards", empty_direct_fetch)

    jobs = asyncio.run(
        service_v2.JobDiscoveryService().discover_jobs(
            role="Senior Test Automation Engineer",
            location="Remote",
            profile_skills=["Playwright"],
            run_verification=False,
            source_catalog=[],
        )
    )

    assert jobs == []
    assert calls == ["ashby", "workday", "generic"]
