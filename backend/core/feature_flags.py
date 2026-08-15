"""Central release flags and deploy-time warning projection."""
from __future__ import annotations

from core.config import settings


def feature_flags() -> dict[str, bool]:
    return {
        "contract_connectors": settings.ENABLE_CONTRACT_CONNECTORS,
        "deterministic_ranking": settings.ENABLE_DETERMINISTIC_RANKING,
        "profile_intelligence": settings.ENABLE_PROFILE_INTELLIGENCE,
        "admin_operations": settings.ENABLE_ADMIN_OPERATIONS,
        "startup_schema_sync": settings.ENABLE_STARTUP_SCHEMA_SYNC,
    }


def deployment_warnings() -> list[dict[str, str]]:
    warnings: list[dict[str, str]] = []
    environment = settings.ENVIRONMENT.lower()
    if settings.REQUIRE_AUTH.lower() != "true":
        warnings.append({
            "code": "auth_optional",
            "severity": "warning" if environment != "production" else "critical",
            "message": "REQUIRE_AUTH is not true; unauthenticated requests use the demo identity.",
        })
    if settings.ENABLE_STARTUP_SCHEMA_SYNC:
        warnings.append({
            "code": "startup_schema_sync",
            "severity": "warning",
            "message": "ORM startup schema synchronization is enabled; managed migrations remain authoritative.",
        })
    if environment == "production" and "demo@jobintel.ai" in settings.ADMIN_EMAILS.lower():
        warnings.append({
            "code": "demo_admin_allowlist",
            "severity": "critical",
            "message": "Remove the demo admin email from ADMIN_EMAILS in production.",
        })
    return warnings
