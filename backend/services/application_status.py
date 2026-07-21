"""Canonical application pipeline status keys and legacy API compatibility."""

from __future__ import annotations

import re


STATUS_LABELS: dict[str, str] = {
    "discovered": "Discovered",
    "saved": "Saved",
    "shortlisted": "Shortlisted",
    "tailoring": "Tailoring",
    "ready_to_apply": "Ready to Apply",
    "applied": "Applied",
    "recruiter_contacted": "Recruiter Contacted",
    "screening": "Screening",
    "assessment": "Assessment",
    "interview": "Interview",
    "final_interview": "Final Interview",
    "offer": "Offer",
    "rejected": "Rejected",
    "archived": "Archived",
}

STATUS_ALIASES: dict[str, str] = {
    "evaluated": "shortlisted",
    "responded": "recruiter_contacted",
    "discarded": "archived",
    "skip": "archived",
    "skipped": "archived",
    "negotiating": "offer",
}


def _key(value: str | None) -> str:
    value = (value or "").strip().lower()
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", value)).strip("_")


def normalize_application_status(value: str | None, *, strict: bool = True) -> str:
    """Return a lowercase canonical key, accepting historical display labels."""
    raw_key = _key(value)
    key = STATUS_ALIASES.get(raw_key, raw_key)
    if key in STATUS_LABELS:
        return key
    if strict:
        raise ValueError(f"Unsupported application status: {value!r}")
    return key


def display_application_status(value: str | None) -> str:
    """Return the stable label consumed by the existing web application."""
    key = normalize_application_status(value, strict=False)
    return STATUS_LABELS.get(key, (value or "").strip())


def canonical_statuses() -> list[str]:
    return list(STATUS_LABELS)


def display_statuses() -> list[str]:
    return list(STATUS_LABELS.values())
