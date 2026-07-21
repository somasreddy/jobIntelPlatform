"""Operational source-registry projection for the admin workspace."""
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import IngestionRun, SourceRegistry

SOURCE_REGISTRY = [
    {"id": "greenhouse", "name": "Greenhouse boards", "type": "ats_api", "priority": 100, "parser_version": "greenhouse-v1", "cadence_minutes": 120, "health_score": 96, "failure_rate": 1.2, "status": "healthy"},
    {"id": "lever", "name": "Lever postings", "type": "ats_api", "priority": 100, "parser_version": "lever-v1", "cadence_minutes": 120, "health_score": 95, "failure_rate": 1.8, "status": "healthy"},
    {"id": "remotive", "name": "Remotive", "type": "feed", "priority": 80, "parser_version": "remotive-v2", "cadence_minutes": 180, "health_score": 94, "failure_rate": 2.1, "status": "healthy"},
    {"id": "arbeitnow", "name": "Arbeitnow", "type": "feed", "priority": 75, "parser_version": "arbeitnow-v2", "cadence_minutes": 180, "health_score": 88, "failure_rate": 4.3, "status": "degraded"},
    {"id": "wwr", "name": "We Work Remotely", "type": "rss", "priority": 70, "parser_version": "wwr-v1", "cadence_minutes": 240, "health_score": 92, "failure_rate": 2.7, "status": "healthy"},
    {"id": "authentic", "name": "Authentic Jobs", "type": "rss", "priority": 65, "parser_version": "authentic-v1", "cadence_minutes": 240, "health_score": 90, "failure_rate": 3.1, "status": "healthy"},
    {"id": "search-seed", "name": "Search seed catalog", "type": "search_seed", "priority": 10, "parser_version": "seed-v1", "cadence_minutes": 1440, "health_score": 70, "failure_rate": 8.0, "status": "assist_only", "enabled": True, "source_group": "mixed"},
]


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _status(source: SourceRegistry) -> str:
    if not source.enabled:
        return "disabled"
    if source.source_type == "search_seed":
        return "assist_only"
    score = float(source.health_score)
    if score >= 90:
        return "healthy"
    if score >= 70:
        return "degraded"
    return "unhealthy"


def _summary(sources: list[dict]) -> dict:
    connectors = [source for source in sources if source["type"] != "search_seed"]
    search_coverage = [source for source in sources if source["type"] == "search_seed"]
    regions = sorted({
        str(region).upper()
        for source in search_coverage
        for region in source.get("regions", [])
        if region
    })
    search_sites = sum(int(source.get("coverage_count", 1)) for source in search_coverage)
    return {
        "registered": len(sources),
        "ingestion_connectors": len(connectors),
        "enabled_connectors": sum(source.get("enabled", True) for source in connectors),
        "healthy": sum(source["status"] == "healthy" for source in connectors),
        "degraded": sum(source["status"] == "degraded" for source in connectors),
        "unhealthy": sum(source["status"] == "unhealthy" for source in connectors),
        "disabled": sum(source["status"] == "disabled" for source in sources),
        "assist_only": sum(source["status"] == "assist_only" for source in search_coverage),
        "search_catalogs": len(search_coverage),
        "search_sites": search_sites,
        "enabled_search_sites": sum(
            int(source.get("coverage_count", 1))
            for source in search_coverage
            if source.get("enabled", True)
        ),
        "search_regions": len(regions),
        "regions": regions,
        "average_health": round(sum(source["health_score"] for source in connectors) / len(connectors), 1) if connectors else 0,
    }


def _snapshot(sources: list[dict], generated_at: datetime, persistence: str) -> dict:
    return {
        "generated_at": generated_at.isoformat(),
        "persistence": persistence,
        "connectors": [source for source in sources if source["type"] != "search_seed"],
        "search_coverage": [source for source in sources if source["type"] == "search_seed"],
        "summary": _summary(sources),
        "policy": {
            "authoritative_types": ["ats_api", "structured_html", "feed", "sitemap", "career_page"],
            "search_results_are_job_truth": False,
            "search_role": "career endpoint seed expansion only",
        },
        "sources": sources,
    }


def source_health_snapshot() -> dict:
    """Return the built-in registry used before enterprise tables are deployed."""
    now = datetime.now(timezone.utc)
    sources = [{**source, "last_checked_at": now.isoformat()} for source in SOURCE_REGISTRY]
    try:
        from job_discovery.source_registry import search_source_catalog

        catalog = search_source_catalog()
        regions = sorted({
            str(region).upper()
            for item in catalog
            for region in item.get("regions", [])
            if region
        })
        search_item = next(source for source in sources if source["type"] == "search_seed")
        search_item.update({"site": "Built-in search catalog", "coverage_count": len(catalog), "regions": regions, "region_count": len(regions)})
    except (ImportError, StopIteration):
        pass
    return _snapshot(sources, now, "static_fallback")


def source_health_snapshot_from_records(
    registry: Iterable[SourceRegistry], runs: Iterable[IngestionRun]
) -> dict:
    """Build the source-health response from persisted ORM records."""
    now = datetime.now(timezone.utc)
    latest_runs: dict[object, IngestionRun] = {}
    for run in runs:
        if run.source_id not in latest_runs:
            latest_runs[run.source_id] = run

    sources = []
    for source in registry:
        adapter_config = getattr(source, "adapter_config", None) or {}
        run = latest_runs.get(source.id)
        last_checked = (
            (run.completed_at or run.started_at or run.created_at) if run else
            (source.last_success_at or source.last_failure_at or source.updated_at)
        )
        item = {
            "id": str(source.id),
            "name": source.name,
            "type": source.source_type,
            "base_url": source.base_url,
            "priority": source.priority,
            "parser_name": source.parser_name,
            "parser_version": source.parser_version,
            "cadence_minutes": source.crawl_frequency_minutes,
            "health_score": float(source.health_score),
            "failure_rate": float(source.failure_rate),
            "enabled": source.enabled,
            "status": _status(source),
            "last_checked_at": _iso(last_checked),
            "last_success_at": _iso(source.last_success_at),
            "last_failure_at": _iso(source.last_failure_at),
            "latest_run": None,
        }
        if run:
            item["latest_run"] = {
                "id": str(run.id),
                "status": run.status,
                "parser_version": run.parser_version,
                "correlation_id": str(run.correlation_id),
                "counters": run.counters or {},
                "error_code": run.error_code,
                "started_at": _iso(run.started_at),
                "completed_at": _iso(run.completed_at),
            }
        if source.source_type == "search_seed":
            regions = sorted({
                str(region).upper()
                for region in (adapter_config.get("regions") or ["GLOBAL"])
                if region
            })
            item.update({
                "site": str(adapter_config.get("site") or source.base_url),
                "source_group": str(adapter_config.get("source_group") or "job_board"),
                "regions": regions,
                "region_count": len(regions),
                "coverage_count": int(adapter_config.get("coverage_count") or 1),
            })
        sources.append(item)
    return _snapshot(sources, now, "database")


async def source_health_snapshot_from_db(db: AsyncSession) -> dict | None:
    """Load persisted health, returning None when the registry has no rows."""
    registry_result = await db.execute(
        select(SourceRegistry).order_by(SourceRegistry.priority.desc(), SourceRegistry.name)
    )
    registry = list(registry_result.scalars().all())
    if not registry:
        return None

    runs_result = await db.execute(
        select(IngestionRun).order_by(IngestionRun.created_at.desc()).limit(500)
    )
    return source_health_snapshot_from_records(registry, runs_result.scalars().all())
