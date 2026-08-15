"""Admin source health, governance controls, run recovery, and audit views."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.rbac import get_current_admin
from models.database import (
    AuditLog,
    IngestionRun,
    OutboxEvent,
    SourceCandidate,
    SourceRegistry,
)
from services.source_health import source_health_snapshot, source_health_snapshot_from_db

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_admin)])


class SourceControlUpdate(BaseModel):
    enabled: bool | None = None
    priority: int | None = Field(default=None, ge=0, le=100)
    crawl_frequency_minutes: int | None = Field(default=None, ge=5, le=43200)
    parser_version: str | None = Field(default=None, min_length=1, max_length=100)


class CandidateReview(BaseModel):
    validation_status: Literal["approved", "rejected"]


def _source_state(source: SourceRegistry) -> dict:
    return {
        "id": str(source.id),
        "name": source.name,
        "enabled": source.enabled,
        "priority": source.priority,
        "crawl_frequency_minutes": source.crawl_frequency_minutes,
        "parser_name": source.parser_name,
        "parser_version": source.parser_version,
        "health_score": float(source.health_score),
        "failure_rate": float(source.failure_rate),
    }


def _run_state(run: IngestionRun) -> dict:
    return {
        "id": str(run.id),
        "source_id": str(run.source_id),
        "parser_version": run.parser_version,
        "correlation_id": str(run.correlation_id),
        "status": run.status,
        "counters": run.counters or {},
        "error_code": run.error_code,
        "error_detail": run.error_detail,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


def _audit(
    *,
    actor_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: str,
    before: dict | None,
    after: dict | None,
    metadata: dict | None = None,
) -> AuditLog:
    return AuditLog(
        actor_id=actor_id,
        actor_type="admin",
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        before_state=before,
        after_state=after,
        audit_metadata=metadata or {},
    )


async def _owned_source(db: AsyncSession, source_id: str) -> SourceRegistry:
    try:
        item_id = uuid.UUID(source_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid source ID")
    result = await db.execute(select(SourceRegistry).where(SourceRegistry.id == item_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@router.get("")
async def get_source_health(db: AsyncSession = Depends(get_db)) -> dict:
    try:
        snapshot = await source_health_snapshot_from_db(db)
        if snapshot is not None:
            return snapshot
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.info("Persisted source registry unavailable; using fallback: %s", exc)
    return source_health_snapshot()


@router.patch("/sources/{source_id}")
async def update_source_control(
    source_id: str,
    payload: SourceControlUpdate,
    admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    source = await _owned_source(db, source_id)
    before = _source_state(source)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(source, field, value)
    source.updated_at = datetime.now(timezone.utc)
    after = _source_state(source)
    db.add(_audit(
        actor_id=admin["user_id"],
        action="source.updated",
        resource_type="source_registry",
        resource_id=str(source.id),
        before=before,
        after=after,
    ))
    await db.flush()
    return after


@router.post("/sources/{source_id}/rerun", status_code=202)
async def rerun_source(
    source_id: str,
    admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    source = await _owned_source(db, source_id)
    if not source.enabled:
        raise HTTPException(status_code=409, detail="Enable the source before requesting a rerun")
    run = IngestionRun(
        source_id=source.id,
        parser_version=source.parser_version,
        correlation_id=uuid.uuid4(),
        status="queued",
        counters={"requested_by": "admin"},
    )
    db.add(run)
    await db.flush()
    db.add(OutboxEvent(
        aggregate_type="ingestion_run",
        aggregate_id=str(run.id),
        event_type="ingestion.run_requested",
        payload={"run_id": str(run.id), "source_id": str(source.id), "reason": "admin_rerun"},
    ))
    db.add(_audit(
        actor_id=admin["user_id"],
        action="ingestion.rerun_requested",
        resource_type="ingestion_run",
        resource_id=str(run.id),
        before=None,
        after=_run_state(run),
        metadata={"source_id": str(source.id)},
    ))
    await db.flush()
    return _run_state(run)


@router.get("/runs")
async def list_ingestion_runs(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    statement = select(IngestionRun).order_by(IngestionRun.created_at.desc()).limit(limit)
    if status_filter:
        statement = statement.where(IngestionRun.status == status_filter)
    result = await db.execute(statement)
    return [_run_state(item) for item in result.scalars().all()]


@router.post("/runs/{run_id}/retry", status_code=202)
async def retry_ingestion_run(
    run_id: str,
    admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        item_id = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run ID")
    result = await db.execute(select(IngestionRun).where(IngestionRun.id == item_id))
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Ingestion run not found")
    if original.status not in {"failed", "partial", "dead_lettered"}:
        raise HTTPException(status_code=409, detail="Only failed, partial, or dead-lettered runs can be retried")
    retry = IngestionRun(
        source_id=original.source_id,
        parser_version=original.parser_version,
        correlation_id=uuid.uuid4(),
        status="queued",
        counters={"retry_of": str(original.id), "requested_by": "admin"},
    )
    db.add(retry)
    await db.flush()
    db.add(OutboxEvent(
        aggregate_type="ingestion_run",
        aggregate_id=str(retry.id),
        event_type="ingestion.retry_requested",
        payload={"run_id": str(retry.id), "retry_of": str(original.id)},
    ))
    db.add(_audit(
        actor_id=admin["user_id"],
        action="ingestion.retry_requested",
        resource_type="ingestion_run",
        resource_id=str(retry.id),
        before=_run_state(original),
        after=_run_state(retry),
    ))
    await db.flush()
    return _run_state(retry)


@router.get("/source-candidates")
async def list_source_candidates(
    status_filter: str = Query(default="pending", alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    statement = (
        select(SourceCandidate)
        .where(SourceCandidate.validation_status == status_filter)
        .order_by(SourceCandidate.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(statement)
    return [
        {
            "id": str(item.id),
            "discovered_url": item.discovered_url,
            "discovery_method": item.discovery_method,
            "validation_status": item.validation_status,
            "detected_source_type": item.detected_source_type,
            "evidence": item.evidence or {},
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        for item in result.scalars().all()
    ]


@router.patch("/source-candidates/{candidate_id}")
async def review_source_candidate(
    candidate_id: str,
    payload: CandidateReview,
    admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        item_id = uuid.UUID(candidate_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid source candidate ID")
    result = await db.execute(select(SourceCandidate).where(SourceCandidate.id == item_id))
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Source candidate not found")
    before = {"validation_status": candidate.validation_status}
    candidate.validation_status = payload.validation_status
    candidate.reviewed_by = admin["user_id"]
    candidate.reviewed_at = datetime.now(timezone.utc)
    after = {"validation_status": candidate.validation_status}
    db.add(_audit(
        actor_id=admin["user_id"],
        action=f"source_candidate.{payload.validation_status}",
        resource_type="source_candidate",
        resource_id=str(candidate.id),
        before=before,
        after=after,
        metadata={"url": candidate.discovered_url},
    ))
    await db.flush()
    return {"id": str(candidate.id), **after}


@router.get("/audit")
async def list_audit_events(
    resource_type: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    statement = select(AuditLog).order_by(AuditLog.occurred_at.desc()).limit(limit)
    if resource_type:
        statement = statement.where(AuditLog.resource_type == resource_type)
    result = await db.execute(statement)
    return [
        {
            "id": str(item.id),
            "actor_id": str(item.actor_id) if item.actor_id else None,
            "actor_type": item.actor_type,
            "action": item.action,
            "resource_type": item.resource_type,
            "resource_id": item.resource_id,
            "before_state": item.before_state,
            "after_state": item.after_state,
            "metadata": item.audit_metadata or {},
            "occurred_at": item.occurred_at.isoformat() if item.occurred_at else None,
        }
        for item in result.scalars().all()
    ]


@router.get("/outbox")
async def list_outbox(
    unpublished_only: bool = True,
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    statement = select(OutboxEvent).order_by(OutboxEvent.occurred_at.desc()).limit(limit)
    if unpublished_only:
        statement = statement.where(OutboxEvent.published_at.is_(None))
    result = await db.execute(statement)
    return [
        {
            "id": str(item.id),
            "aggregate_type": item.aggregate_type,
            "aggregate_id": item.aggregate_id,
            "event_type": item.event_type,
            "attempts": item.attempts,
            "last_error": item.last_error,
            "occurred_at": item.occurred_at.isoformat() if item.occurred_at else None,
            "published_at": item.published_at.isoformat() if item.published_at else None,
        }
        for item in result.scalars().all()
    ]


@router.post("/outbox/{event_id}/retry", status_code=202)
async def retry_outbox_event(
    event_id: str,
    admin: dict = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        item_id = uuid.UUID(event_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid outbox event ID")
    result = await db.execute(select(OutboxEvent).where(OutboxEvent.id == item_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Outbox event not found")
    before = {"attempts": event.attempts, "last_error": event.last_error, "published_at": str(event.published_at or "")}
    event.published_at = None
    event.last_error = None
    event.attempts = 0
    after = {"attempts": 0, "last_error": None, "published_at": None}
    db.add(_audit(
        actor_id=admin["user_id"],
        action="outbox.retry_requested",
        resource_type="outbox_event",
        resource_id=str(event.id),
        before=before,
        after=after,
    ))
    await db.flush()
    return {"id": str(event.id), "status": "queued_for_retry"}
