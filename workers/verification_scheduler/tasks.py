import asyncio
import os
import sys
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

from celeryconfig import celery_app

logger = logging.getLogger(__name__)

_BATCH_SIZE = 20  # verify this many jobs per run


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@celery_app.task(
    name="verification_scheduler.tasks.verify_pending_jobs", bind=True, max_retries=2
)
def verify_pending_jobs(self):
    """
    Periodic task: pick UNVERIFIED jobs and verify their links via HTTP.
    Updates verification_status to VERIFIED or EXPIRED.
    """
    logger.info("Starting scheduled job verification...")
    try:
        from verification_engine.verifier import VerificationEngine
        from core.database import AsyncSessionLocal
        from models.database import VerifiedJob
        from sqlalchemy import select

        engine = VerificationEngine()

        async def _verify_batch():
            verified = expired = 0
            async with AsyncSessionLocal() as session:
                stmt = (
                    select(VerifiedJob)
                    .where(VerifiedJob.verification_status == "UNVERIFIED")
                    .limit(_BATCH_SIZE)
                )
                result = await session.execute(stmt)
                jobs = result.scalars().all()

                for job in jobs:
                    job_dict = {
                        "title": job.title,
                        "organization": job.organization,
                        "application_link": job.application_link or "",
                        "career_page_link": job.career_page_link or "",
                    }
                    updated = await engine.verify_job(job_dict)
                    status = updated.get("verification_status", "UNVERIFIED")
                    job.verification_status = status
                    if status == "VERIFIED":
                        verified += 1
                    elif status == "EXPIRED":
                        expired += 1

                await session.commit()
            return verified, expired

        verified, expired = _run(_verify_batch())
        logger.info(
            "Verification complete: %d verified, %d expired.", verified, expired
        )
        return {"status": "success", "verified": verified, "expired": expired}

    except Exception as exc:
        logger.error("Verification task failed: %s", exc)
        raise self.retry(exc=exc, countdown=120)
