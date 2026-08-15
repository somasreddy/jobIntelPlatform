"""Pure ATS connector contracts, parsers, drift signals, and fallbacks."""
from __future__ import annotations

import html
import json
import re
from dataclasses import asdict, dataclass, field
from typing import Any, Literal
from urllib.parse import urljoin


ConnectorKind = Literal["greenhouse", "lever", "workday", "ashby", "generic"]


@dataclass(frozen=True)
class ConnectorCapabilities:
    pagination: bool
    detail_fetch: bool
    structured_locations: bool
    salary_when_published: bool
    fallback: str


@dataclass(frozen=True)
class ConnectorDefinition:
    kind: ConnectorKind
    parser_version: str
    root_key: str | None
    capabilities: ConnectorCapabilities


@dataclass(frozen=True)
class ConnectorIssue:
    code: str
    message: str
    severity: Literal["warning", "error"] = "warning"
    item_index: int | None = None


@dataclass
class ConnectorBatch:
    connector: ConnectorKind
    parser_version: str
    jobs: list[dict] = field(default_factory=list)
    issues: list[ConnectorIssue] = field(default_factory=list)
    status: Literal["healthy", "partial", "drifted"] = "healthy"
    fallback: str = "none"
    received: int = 0
    rejected: int = 0

    def telemetry(self) -> dict:
        return {
            "connector": self.connector,
            "parser_version": self.parser_version,
            "status": self.status,
            "fallback": self.fallback,
            "received": self.received,
            "accepted": len(self.jobs),
            "rejected": self.rejected,
            "issues": [asdict(issue) for issue in self.issues],
        }


DEFINITIONS: dict[ConnectorKind, ConnectorDefinition] = {
    "greenhouse": ConnectorDefinition(
        "greenhouse", "greenhouse-v2", "jobs",
        ConnectorCapabilities(False, True, True, True, "career_page"),
    ),
    "lever": ConnectorDefinition(
        "lever", "lever-v2", None,
        ConnectorCapabilities(True, True, True, True, "career_page"),
    ),
    "workday": ConnectorDefinition(
        "workday", "workday-v1", "jobPostings",
        ConnectorCapabilities(True, True, True, False, "career_page"),
    ),
    "ashby": ConnectorDefinition(
        "ashby", "ashby-v1", "jobs",
        ConnectorCapabilities(False, True, True, True, "career_page"),
    ),
    "generic": ConnectorDefinition(
        "generic", "schema-jobposting-v1", None,
        ConnectorCapabilities(False, True, False, True, "source_candidate_review"),
    ),
}


def _strip_html(value: Any) -> str:
    text = html.unescape(str(value or ""))
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text)).strip()


def _work_mode(*values: Any) -> str:
    text = " ".join(str(value or "") for value in values).lower()
    if "remote" in text or "telecommute" in text:
        return "Remote"
    if "hybrid" in text:
        return "Hybrid"
    return "On-site"


def _number(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace(",", "").replace("$", "").strip())
    except ValueError:
        return None


def _location_name(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        address = value.get("address") if isinstance(value.get("address"), dict) else {}
        parts = [
            value.get("name"),
            address.get("addressLocality"),
            address.get("addressRegion"),
            address.get("addressCountry"),
        ]
        return ", ".join(str(part) for part in parts if part)
    if isinstance(value, list):
        return ", ".join(filter(None, (_location_name(item) for item in value)))
    return ""


def _canonical_job(
    *,
    definition: ConnectorDefinition,
    organization: str,
    title: Any,
    location: Any,
    description: Any,
    application_link: Any,
    requisition_id: Any = None,
    posted_date: Any = None,
    salary_min: Any = None,
    salary_max: Any = None,
    currency: Any = "USD",
    career_page: str = "",
    confidence: float = 0.9,
) -> dict:
    location_text = _location_name(location) or "Location not published"
    description_text = _strip_html(description)
    return {
        "title": str(title or "").strip(),
        "organization": organization.strip(),
        "location": location_text,
        "work_mode": _work_mode(location_text, description_text),
        "salary_min": _number(salary_min),
        "salary_max": _number(salary_max),
        "currency": str(currency or "USD").upper(),
        "description": description_text[:5000],
        "technologies": [],
        "application_link": str(application_link or "").strip(),
        "career_page_link": career_page,
        "external_requisition_id": str(requisition_id or "").strip() or None,
        "posted_date": str(posted_date or "")[:10],
        "verification_status": "VERIFIED",
        "source": definition.kind.title(),
        "source_adapter": definition.kind,
        "parser_version": definition.parser_version,
        "extraction_confidence": confidence,
        "source_capabilities": asdict(definition.capabilities),
    }


def _items_for(definition: ConnectorDefinition, payload: Any) -> list[dict] | None:
    if definition.kind == "lever":
        return payload if isinstance(payload, list) else None
    if definition.kind == "generic":
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict):
            if payload.get("@type") == "JobPosting":
                return [payload]
            graph = payload.get("@graph")
            if isinstance(graph, list):
                return [item for item in graph if isinstance(item, dict) and item.get("@type") == "JobPosting"]
            jobs = payload.get("jobs")
            return jobs if isinstance(jobs, list) else None
        return None
    if not isinstance(payload, dict):
        return None
    items = payload.get(definition.root_key or "")
    return items if isinstance(items, list) else None


def _parse_item(kind: ConnectorKind, item: dict, organization: str, base_url: str) -> dict:
    definition = DEFINITIONS[kind]
    if kind == "greenhouse":
        pay = (item.get("pay_input_ranges") or [{}])[0] if isinstance(item.get("pay_input_ranges"), list) else {}
        return _canonical_job(
            definition=definition, organization=organization,
            title=item.get("title"), location=item.get("location"),
            description=item.get("content"), application_link=item.get("absolute_url") or item.get("url"),
            requisition_id=item.get("id"), posted_date=item.get("updated_at"),
            salary_min=pay.get("min_cents") / 100 if _number(pay.get("min_cents")) is not None else None,
            salary_max=pay.get("max_cents") / 100 if _number(pay.get("max_cents")) is not None else None,
            currency=pay.get("currency_type") or "USD", career_page=base_url,
        )
    if kind == "lever":
        categories = item.get("categories") if isinstance(item.get("categories"), dict) else {}
        salary = item.get("salaryRange") if isinstance(item.get("salaryRange"), dict) else {}
        details = " ".join(
            _strip_html(part.get("content"))
            for part in (item.get("lists") or [])
            if isinstance(part, dict)
        )
        return _canonical_job(
            definition=definition, organization=organization,
            title=item.get("text"), location=categories.get("location"),
            description=f"{item.get('description') or ''} {details}",
            application_link=item.get("applyUrl") or item.get("hostedUrl"),
            requisition_id=item.get("id"), posted_date=item.get("createdAt"),
            salary_min=salary.get("min"), salary_max=salary.get("max"),
            currency=salary.get("currency") or "USD", career_page=base_url,
        )
    if kind == "workday":
        external_path = item.get("externalPath") or item.get("jobPath") or ""
        return _canonical_job(
            definition=definition, organization=organization,
            title=item.get("title"), location=item.get("locationsText") or item.get("location"),
            description=item.get("jobDescription") or " ".join(item.get("bulletFields") or []),
            application_link=urljoin(base_url.rstrip("/") + "/", str(external_path).lstrip("/")),
            requisition_id=item.get("bulletFields", [None])[0] if item.get("bulletFields") else item.get("id"),
            posted_date=item.get("postedOn") or item.get("postedDate"), career_page=base_url,
        )
    if kind == "ashby":
        compensation = item.get("compensation") if isinstance(item.get("compensation"), dict) else {}
        return _canonical_job(
            definition=definition, organization=organization,
            title=item.get("title"), location=item.get("location") or item.get("secondaryLocations"),
            description=item.get("descriptionHtml") or item.get("descriptionPlain"),
            application_link=item.get("applyUrl") or item.get("jobUrl"),
            requisition_id=item.get("id"), posted_date=item.get("publishedDate"),
            salary_min=compensation.get("min"), salary_max=compensation.get("max"),
            currency=compensation.get("currency") or "USD", career_page=base_url,
        )

    salary = item.get("baseSalary") if isinstance(item.get("baseSalary"), dict) else {}
    salary_value = salary.get("value") if isinstance(salary.get("value"), dict) else {}
    hiring = item.get("hiringOrganization") if isinstance(item.get("hiringOrganization"), dict) else {}
    return _canonical_job(
        definition=definition, organization=hiring.get("name") or organization,
        title=item.get("title"), location=item.get("jobLocation"),
        description=item.get("description"), application_link=item.get("url") or item.get("applicationUrl"),
        requisition_id=item.get("identifier", {}).get("value") if isinstance(item.get("identifier"), dict) else item.get("identifier"),
        posted_date=item.get("datePosted"), salary_min=salary_value.get("minValue"),
        salary_max=salary_value.get("maxValue"), currency=salary.get("currency") or "USD",
        career_page=base_url, confidence=0.72,
    )


def parse_connector_payload(
    kind: ConnectorKind,
    payload: Any,
    *,
    organization: str,
    base_url: str,
) -> ConnectorBatch:
    definition = DEFINITIONS[kind]
    batch = ConnectorBatch(
        connector=kind,
        parser_version=definition.parser_version,
        fallback=definition.capabilities.fallback,
    )
    items = _items_for(definition, payload)
    if items is None:
        root = definition.root_key or "top-level array / JobPosting"
        batch.status = "drifted"
        batch.issues.append(ConnectorIssue(
            "schema_drift",
            f"Expected {root} for {kind}; payload shape no longer matches the parser contract.",
            "error",
        ))
        return batch

    batch.received = len(items)
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            batch.rejected += 1
            batch.issues.append(ConnectorIssue("invalid_item", "Item is not an object.", item_index=index))
            continue
        try:
            job = _parse_item(kind, item, organization, base_url)
        except (AttributeError, TypeError, ValueError) as exc:
            batch.rejected += 1
            batch.issues.append(ConnectorIssue("parse_error", str(exc), item_index=index))
            continue
        missing = [name for name in ("title", "organization", "application_link") if not job.get(name)]
        if missing:
            batch.rejected += 1
            batch.issues.append(ConnectorIssue(
                "missing_required_fields",
                f"Missing required normalized fields: {', '.join(missing)}",
                item_index=index,
            ))
            continue
        batch.jobs.append(job)

    if batch.rejected:
        batch.status = "partial" if batch.jobs else "drifted"
    return batch


def parse_json_ld_html(document: str) -> list[dict]:
    """Extract only schema.org JobPosting JSON-LD from a generic career page."""
    payloads: list[dict] = []
    for match in re.finditer(
        r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
        document or "",
        flags=re.IGNORECASE | re.DOTALL,
    ):
        try:
            value = json.loads(html.unescape(match.group(1)).strip())
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(value, dict):
            payloads.append(value)
        elif isinstance(value, list):
            payloads.extend(item for item in value if isinstance(item, dict))
    return payloads
