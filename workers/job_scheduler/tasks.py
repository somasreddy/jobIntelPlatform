import asyncio
import os
import sys
import logging

# Make the backend package importable from the worker context
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from celeryconfig import celery_app

logger = logging.getLogger(__name__)


def _run(coro):
    """Run a coroutine synchronously inside a Celery task."""
    return asyncio.get_event_loop().run_until_complete(coro)


@celery_app.task(name="job_scheduler.tasks.discover_new_jobs", bind=True, max_retries=3)
def discover_new_jobs(self, deep: bool = False):
    """
    Periodic task: fetch QA/SDET jobs from public APIs and upsert into PostgreSQL.
    """
    logger.info("Starting scheduled job discovery (deep=%s)...", deep)
    try:
        from job_discovery.service import JobDiscoveryService
        from core.database import AsyncSessionLocal
        from models.database import VerifiedJob
        from sqlalchemy import select

        service = JobDiscoveryService()
        jobs = _run(service.discover_jobs())

        async def _save(jobs_list):
            saved = 0
            async with AsyncSessionLocal() as session:
                for job_data in jobs_list:
                    # Deduplicate by title + organization
                    stmt = select(VerifiedJob).where(
                        VerifiedJob.title == job_data["title"],
                        VerifiedJob.organization == job_data["organization"],
                    )
                    result = await session.execute(stmt)
                    existing = result.scalar_one_or_none()
                    if existing:
                        continue
                    job = VerifiedJob(**{
                        k: v for k, v in job_data.items()
                        if k in VerifiedJob.__table__.columns.keys()
                    })
                    session.add(job)
                    saved += 1
                await session.commit()
            return saved

        saved = _run(_save(jobs))
        logger.info("Job discovery complete: %d new jobs saved.", saved)
        return {"status": "success", "jobs_found": len(jobs), "jobs_saved": saved}

    except Exception as exc:
        logger.error("Job discovery failed: %s", exc)
        raise self.retry(exc=exc, countdown=60)
