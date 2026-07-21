"""Network orchestration for contract-driven ATS and career-page adapters."""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any

import httpx

from core.config import settings

from job_discovery.connector_contracts import (
    ConnectorBatch,
    ConnectorIssue,
    ConnectorKind,
    parse_connector_payload,
    parse_json_ld_html,
)

logger = logging.getLogger(__name__)
_TIMEOUT = httpx.Timeout(15.0, connect=5.0)
_HEADERS = {
    "Accept": "application/json, text/html;q=0.8",
    "User-Agent": "JobIntelligencePlatform/2.0 (+source-health)",
}
_LAST_TELEMETRY: dict[str, list[dict]] = {}


_GREENHOUSE_COMPANIES = [
    "airbnb", "stripe", "notion", "linear", "figma", "vercel", "netlify",
    "hashicorp", "mongodb", "elastic", "grafana", "databricks", "snowflake",
    "cockroachlabs", "supabase", "posthog", "segment",
]
_LEVER_COMPANIES = [
    "netflix", "shopify", "hubspot", "intercom", "atlassian", "cloudflare",
    "okta", "pagerduty", "sendbird", "brex", "plaid", "robinhood",
    "reddit", "discord", "twitch", "airtable", "miro", "loom", "lattice",
]


def _words(query: str) -> list[str]:
    return [word.lower() for word in query.split() if len(word) > 2]


def _matches(job: dict, query: str) -> bool:
    words = _words(query)
    if not words:
        return True
    haystack = f"{job.get('title', '')} {job.get('description', '')}".lower()
    return any(word in haystack for word in words)


def _configured_sources(variable: str) -> list[dict]:
    raw = os.getenv(variable, "[]")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("%s is not valid JSON; connector disabled", variable)
        return []
    return [item for item in parsed if isinstance(item, dict)] if isinstance(parsed, list) else []


def _ashby_sources() -> list[dict]:
    try:
        from job_discovery.portals_config import get_ashby_companies
        companies = get_ashby_companies()[:30]
    except (ImportError, AttributeError):
        companies = []
    return [
        {
            "organization": item["company"],
            "endpoint": "https://api.ashbyhq.com/posting-api/job-board/"
            + item["careers_url"].rstrip("/").split("/")[-1],
            "career_url": item["careers_url"],
        }
        for item in companies
        if item.get("company") and item.get("careers_url")
    ]


def get_connector_telemetry() -> dict[str, list[dict]]:
    """Return a copy of the latest per-source contract outcomes."""
    return {key: [dict(item) for item in values] for key, values in _LAST_TELEMETRY.items()}


async def _fallback_to_career_page(
    client: httpx.AsyncClient,
    source: dict,
    *,
    primary_kind: ConnectorKind,
    primary_batch: ConnectorBatch,
) -> list[dict]:
    career_url = str(source.get("career_url") or "")
    if not career_url or primary_batch.fallback != "career_page":
        return []
    try:
        response = await client.get(career_url, headers=_HEADERS)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        primary_batch.issues.append(ConnectorIssue(
            "fallback_fetch_failed", f"Career-page fallback failed: {type(exc).__name__}"
        ))
        return []

    payloads = parse_json_ld_html(response.text)
    fallback = parse_connector_payload(
        "generic",
        payloads,
        organization=str(source.get("organization") or "Unknown"),
        base_url=career_url,
    )
    for job in fallback.jobs:
        job["fallback_used"] = "career_page"
        job["primary_source_adapter"] = primary_kind
    return fallback.jobs


async def _fetch_one(
    client: httpx.AsyncClient,
    kind: ConnectorKind,
    source: dict,
    query: str,
) -> tuple[list[dict], dict]:
    organization = str(source.get("organization") or "Unknown")
    endpoint = str(source.get("endpoint") or "")
    career_url = str(source.get("career_url") or endpoint)
    if not endpoint:
        batch = ConnectorBatch(
            connector=kind,
            parser_version="unconfigured",
            status="drifted",
            fallback="source_candidate_review",
            issues=[ConnectorIssue("missing_endpoint", "No endpoint configured.", "error")],
        )
        return [], batch.telemetry()

    try:
        if kind == "workday":
            request_body = {
                "appliedFacets": {},
                "limit": 20,
                "offset": 0,
                "searchText": query,
                **(source.get("request_body") or {}),
            }
            response = await client.post(endpoint, json=request_body, headers=_HEADERS)
        else:
            response = await client.get(endpoint, headers=_HEADERS)
        response.raise_for_status()

        if kind == "generic":
            payload: Any = parse_json_ld_html(response.text)
        else:
            payload = response.json()
        batch = parse_connector_payload(
            kind,
            payload,
            organization=organization,
            base_url=career_url,
        )
    except (httpx.HTTPError, ValueError, json.JSONDecodeError) as exc:
        batch = ConnectorBatch(
            connector=kind,
            parser_version="network",
            status="drifted",
            fallback="career_page" if kind != "generic" else "source_candidate_review",
            issues=[ConnectorIssue(
                "fetch_or_decode_failed",
                f"{type(exc).__name__}: source response unavailable or invalid.",
                "error",
            )],
        )

    jobs = batch.jobs
    if batch.status == "drifted":
        jobs = await _fallback_to_career_page(
            client, source, primary_kind=kind, primary_batch=batch
        )
    jobs = [job for job in jobs if _matches(job, query)]
    return jobs[:50], batch.telemetry()


async def _fetch_sources(kind: ConnectorKind, sources: list[dict], query: str) -> list[dict]:
    if not settings.ENABLE_CONTRACT_CONNECTORS:
        _LAST_TELEMETRY[kind] = [{
            "connector": kind,
            "status": "disabled",
            "reason": "feature flag disabled",
            "accepted": 0,
        }]
        return []
    if not sources:
        _LAST_TELEMETRY[kind] = [{
            "connector": kind,
            "status": "disabled",
            "reason": "no configured sources",
            "accepted": 0,
        }]
        return []

    limits = httpx.Limits(max_connections=12, max_keepalive_connections=6)
    async with httpx.AsyncClient(timeout=_TIMEOUT, limits=limits, follow_redirects=True) as client:
        outcomes = await asyncio.gather(
            *(_fetch_one(client, kind, source, query) for source in sources),
            return_exceptions=True,
        )

    jobs: list[dict] = []
    telemetry: list[dict] = []
    for outcome in outcomes:
        if isinstance(outcome, Exception):
            telemetry.append({
                "connector": kind,
                "status": "drifted",
                "reason": type(outcome).__name__,
                "accepted": 0,
            })
            continue
        batch_jobs, batch_telemetry = outcome
        jobs.extend(batch_jobs)
        telemetry.append(batch_telemetry)
    _LAST_TELEMETRY[kind] = telemetry
    logger.info(
        "%s connector accepted %s jobs from %s sources; drifted=%s",
        kind,
        len(jobs),
        len(sources),
        sum(1 for item in telemetry if item.get("status") == "drifted"),
    )
    return jobs


async def _fetch_greenhouse(query: str) -> list[dict]:
    sources = [
        {
            "organization": slug.replace("-", " ").title(),
            "endpoint": f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true",
            "career_url": f"https://job-boards.greenhouse.io/{slug}",
        }
        for slug in _GREENHOUSE_COMPANIES
    ]
    return await _fetch_sources("greenhouse", sources, query)


async def _fetch_lever(query: str) -> list[dict]:
    sources = [
        {
            "organization": slug.replace("-", " ").title(),
            "endpoint": f"https://api.lever.co/v0/postings/{slug}?mode=json",
            "career_url": f"https://jobs.lever.co/{slug}",
        }
        for slug in _LEVER_COMPANIES
    ]
    return await _fetch_sources("lever", sources, query)


async def _fetch_ashby(query: str) -> list[dict]:
    return await _fetch_sources("ashby", _ashby_sources(), query)


async def _fetch_workday(query: str) -> list[dict]:
    """Fetch configured tenant endpoints from JOBINTEL_WORKDAY_SOURCES JSON."""
    return await _fetch_sources(
        "workday", _configured_sources("JOBINTEL_WORKDAY_SOURCES"), query
    )


async def _fetch_generic(query: str) -> list[dict]:
    """Fetch configured career pages from JOBINTEL_GENERIC_CAREER_SOURCES JSON."""
    return await _fetch_sources(
        "generic", _configured_sources("JOBINTEL_GENERIC_CAREER_SOURCES"), query
    )


async def _fetch_wellfound(query: str) -> list[dict]:
    """Deprecated fragile GraphQL source retained as a compatibility no-op."""
    _LAST_TELEMETRY["wellfound"] = [{
        "connector": "wellfound",
        "status": "disabled",
        "reason": "uncontracted public GraphQL source",
        "accepted": 0,
    }]
    return []
