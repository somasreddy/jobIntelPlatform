"""Canonical ingestion primitives shared by all source adapters.

This module has no network or database dependency. Workers can replay captured
source payloads through it deterministically and test parser changes safely.
"""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Awaitable, Callable, Literal, Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

SourceType = Literal["ats_api", "structured_html", "feed", "rss", "sitemap", "career_page", "search_seed"]
_TRACKING_PARAMS = {"gclid", "fbclid", "ref", "referrer", "source"}
_TRACKING_PREFIXES = ("utm_",)


@dataclass(frozen=True)
class SourceRegistryEntry:
    id: str
    name: str
    source_type: SourceType
    priority: int
    parser_version: str
    crawl_frequency_minutes: int
    enabled: bool = True
    compliance_policy: dict = field(default_factory=dict)


@dataclass(frozen=True)
class RetryPolicy:
    delays_seconds: tuple[int, ...] = (60, 300, 1800, 7200)
    retryable_statuses: tuple[int, ...] = (408, 425, 429, 500, 502, 503, 504)

    def delay_for_attempt(self, attempt: int, retry_after: int | None = None) -> int | None:
        if retry_after is not None:
            return max(0, retry_after)
        if attempt < 0 or attempt >= len(self.delays_seconds):
            return None
        return self.delays_seconds[attempt]


class SourceAdapter(Protocol):
    registry: SourceRegistryEntry

    async def discover(self) -> list[str]: ...
    async def fetch(self, endpoint: str) -> bytes: ...
    async def extract(self, raw: bytes) -> list[dict]: ...
    async def verify_open(self, job: dict) -> bool: ...
    async def health_probe(self) -> dict: ...


def canonicalize_url(value: str | None) -> str:
    if not value:
        return ""
    try:
        parts = urlsplit(value.strip())
    except ValueError:
        return value.strip()
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        return value.strip()
    host = parts.netloc.lower()
    if host.endswith(":80") and parts.scheme == "http":
        host = host[:-3]
    if host.endswith(":443") and parts.scheme == "https":
        host = host[:-4]
    path = re.sub(r"/{2,}", "/", parts.path or "/")
    if path != "/":
        path = path.rstrip("/")
    query = [
        (key, item)
        for key, item in parse_qsl(parts.query, keep_blank_values=True)
        if key.lower() not in _TRACKING_PARAMS
        and not key.lower().startswith(_TRACKING_PREFIXES)
    ]
    return urlunsplit((parts.scheme.lower(), host, path, urlencode(sorted(query)), ""))


def canonical_fingerprint(job: dict) -> str:
    def normalize(value: object) -> str:
        return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()

    identity = "|".join(normalize(job.get(field)) for field in ("title", "organization", "location"))
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()


def _parse_observed_date(value: object) -> datetime | None:
    if not value:
        return None
    text = str(value).strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        try:
            return datetime.strptime(text[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return None


def freshness_score(job: dict, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    observed = _parse_observed_date(job.get("last_verified_at") or job.get("posted_date"))
    if observed is None:
        base = 35
    else:
        age_hours = max(0, (now - observed).total_seconds() / 3600)
        if age_hours <= 24:
            base = 100
        elif age_hours <= 72:
            base = 90
        elif age_hours <= 168:
            base = 75
        elif age_hours <= 336:
            base = 55
        elif age_hours <= 720:
            base = 35
        else:
            base = 10
    status = str(job.get("verification_status") or "").upper()
    if status == "VERIFIED":
        base = min(100, base + 5)
    elif status == "UNVERIFIED":
        base = max(0, base - 15)
    return base


def normalize_job(job: dict, *, source_id: str | None = None, observed_at: datetime | None = None) -> dict:
    observed_at = observed_at or datetime.now(timezone.utc)
    normalized = dict(job)
    application_url = canonicalize_url(job.get("application_link"))
    career_url = canonicalize_url(job.get("career_page_link"))
    normalized["application_link"] = application_url or job.get("application_link")
    normalized["career_page_link"] = career_url or job.get("career_page_link")
    normalized["canonical_url"] = application_url or career_url
    normalized["canonical_fingerprint"] = canonical_fingerprint(normalized)
    normalized["last_seen_at"] = observed_at.isoformat()
    normalized.setdefault("first_seen_at", observed_at.isoformat())
    normalized["freshness_score"] = freshness_score(normalized, observed_at)
    normalized["source_key"] = source_id or str(job.get("source") or "unknown").lower()
    normalized["field_provenance"] = {
        field_name: {
            "source_id": normalized["source_key"],
            "parser_version": job.get("parser_version") or "legacy-adapter",
            "observed_at": observed_at.isoformat(),
            "confidence": job.get("extraction_confidence", .75),
        }
        for field_name in (
            "title", "organization", "location", "work_mode", "description",
            "salary_min", "salary_max", "application_link", "posted_date",
        )
        if normalized.get(field_name) not in (None, "", [])
    }
    return normalized


def deduplicate_jobs(jobs: list[dict]) -> list[dict]:
    """Deduplicate in trust order: URL, source requisition, then fingerprint."""
    result: list[dict] = []
    seen_urls: set[str] = set()
    seen_requisitions: set[tuple[str, str]] = set()
    seen_fingerprints: set[str] = set()
    for raw_job in jobs:
        job = raw_job if raw_job.get("canonical_fingerprint") else normalize_job(raw_job)
        url = str(job.get("canonical_url") or "")
        source_id = str(job.get("source_id") or job.get("source_key") or "")
        requisition_id = str(job.get("external_requisition_id") or "")
        requisition_key = (source_id, requisition_id)
        fingerprint = str(job.get("canonical_fingerprint") or "")
        duplicate = (
            bool(url and url in seen_urls)
            or bool(requisition_id and requisition_key in seen_requisitions)
            or bool(fingerprint and fingerprint in seen_fingerprints)
        )
        if duplicate:
            continue
        if url:
            seen_urls.add(url)
        if requisition_id:
            seen_requisitions.add(requisition_key)
        if fingerprint:
            seen_fingerprints.add(fingerprint)
        result.append(job)
    return result


def normalize_and_deduplicate(jobs: list[dict]) -> list[dict]:
    observed_at = datetime.now(timezone.utc)
    return deduplicate_jobs([normalize_job(job, observed_at=observed_at) for job in jobs])
