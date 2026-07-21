import asyncio
import os
import sys
import logging
from datetime import datetime

# Make the backend package importable from the worker context
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from celeryconfig import celery_app

logger = logging.getLogger(__name__)


def _run(coro):
    """Run a coroutine synchronously inside a Celery task."""
    return asyncio.run(coro)


@celery_app.task(name="job_scheduler.tasks.discover_new_jobs", bind=True, max_retries=3)
def discover_new_jobs(self, deep: bool = False):
    """
    Periodic task: fetch QA/SDET jobs from public APIs and upsert into PostgreSQL.
    """
    logger.info("Starting scheduled job discovery (deep=%s)...", deep)
    try:
        from job_discovery.service_v2 import JobDiscoveryService
        from core.database import AsyncSessionLocal
        from models.database import VerifiedJob
        from sqlalchemy import or_, select

        service = JobDiscoveryService()
        jobs = _run(service.discover_jobs(role="Software Engineer", location="Remote"))

        async def _save(jobs_list):
            saved = updated = 0
            column_names = set(VerifiedJob.__table__.columns.keys())
            async with AsyncSessionLocal() as session:
                for job_data in jobs_list:
                    conditions = []
                    if job_data.get("canonical_url") and "canonical_url" in column_names:
                        conditions.append(VerifiedJob.canonical_url == job_data["canonical_url"])
                    if job_data.get("canonical_fingerprint") and "canonical_fingerprint" in column_names:
                        conditions.append(VerifiedJob.canonical_fingerprint == job_data["canonical_fingerprint"])
                    if job_data.get("external_requisition_id") and "external_requisition_id" in column_names:
                        conditions.append(VerifiedJob.external_requisition_id == job_data["external_requisition_id"])
                    if not conditions:
                        conditions = [
                            VerifiedJob.title == job_data["title"],
                            VerifiedJob.organization == job_data["organization"],
                        ]
                    result = await session.execute(select(VerifiedJob).where(or_(*conditions)))
                    existing = result.scalar_one_or_none()
                    values = {key: value for key, value in job_data.items() if key in column_names}
                    if "normalized_payload" in column_names:
                        values["normalized_payload"] = {
                            "source": job_data.get("source"),
                            "discovery_policy": job_data.get("discovery_policy"),
                        }
                    for key in ("first_seen_at", "last_seen_at", "last_verified_at", "expires_at", "suppressed_at"):
                        raw_value = values.get(key)
                        if isinstance(raw_value, str):
                            values[key] = datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
                    if existing:
                        for key in ("last_seen_at", "last_verified_at", "freshness_score", "verification_status", "field_provenance", "normalized_payload"):
                            if key in values:
                                setattr(existing, key, values[key])
                        updated += 1
                        continue
                    session.add(VerifiedJob(**values))
                    saved += 1
                await session.commit()
            return saved, updated

        saved, updated = _run(_save(jobs))
        logger.info("Job discovery complete: %d new, %d refreshed.", saved, updated)
        return {"status": "success", "jobs_found": len(jobs), "jobs_saved": saved, "jobs_refreshed": updated}

    except Exception as exc:
        logger.error("Job discovery failed: %s", exc)
        from job_discovery.pipeline import RetryPolicy
        delay = RetryPolicy().delay_for_attempt(self.request.retries)
        raise self.retry(exc=exc, countdown=delay or 7200)
