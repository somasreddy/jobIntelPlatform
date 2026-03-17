import os
from celery import Celery
from celery.schedules import crontab

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "job_intelligence_workers",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "job_scheduler.tasks",
        "verification_scheduler.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    # Discover new jobs every 15 minutes
    "discover-jobs-every-15-mins": {
        "task": "job_scheduler.tasks.discover_new_jobs",
        "schedule": 900.0,
    },
    # Verify pending jobs every 30 minutes
    "verify-jobs-every-30-mins": {
        "task": "verification_scheduler.tasks.verify_pending_jobs",
        "schedule": 1800.0,
    },
    # Deep discovery once a day at 2 AM UTC
    "deep-discovery-daily": {
        "task": "job_scheduler.tasks.discover_new_jobs",
        "schedule": crontab(hour=2, minute=0),
        "kwargs": {"deep": True},
    },
}
