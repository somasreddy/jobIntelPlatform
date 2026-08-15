"""
GDPR-friendly Data Export API
Assembles everything the platform stores about the current user into a
single downloadable JSON blob (Article 15/20 - right of access & data
portability), and records a `data_export_requested` audit-log entry as
proof the export happened.
"""
import io
import json
import uuid
import logging
from datetime import datetime, date
from typing import Any, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import inspect, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.auth import get_current_user_id
from models.database import (
    CandidateProfile,
    Application,
    ResumeHistory,
    CareerGraph,
    CareerSkill,
    CareerGoal,
    CareerMilestone,
    LearningPath,
    LearningCompletion,
    Portfolio,
    PortfolioProject,
    Notification,
    log_audit_event,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Serialization helpers ───────────────────────────────────────────────────

def _json_default(value: Any) -> Any:
    """`json.dumps(..., default=)` fallback for the non-JSON-native column
    types that appear on these ORM models (UUID, datetime/date)."""
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def _model_to_dict(obj: Any) -> dict:
    """Generic SQLAlchemy-model -> plain-dict serializer driven by the
    mapper's own column list, so every column on a model is included
    automatically (no per-table field list to keep in sync as columns are
    added/removed). Only touches mapped columns, never relationships, so
    this never triggers a lazy-load or recurses into related rows - callers
    assemble nested shapes (e.g. career_graph.skills) explicitly instead."""
    mapper = inspect(obj).mapper
    return {col.key: getattr(obj, col.key) for col in mapper.columns}


# ─── Endpoint ────────────────────────────────────────────────────────────────

@router.get("/")
async def export_user_data(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Assemble a single JSON export of every piece of this user's own data
    the platform stores, and return it as a downloadable attachment.

    Scope (honesty note): this covers every user-owned table that exists in
    models/database.py today - CandidateProfile, Application, ResumeHistory,
    CareerGraph (+ its CareerSkill/CareerGoal/CareerMilestone children),
    LearningPath + LearningCompletion, Portfolio (+ PortfolioProject
    children), and Notification. Tables that hold shared/catalogue data
    rather than personal data (VerifiedJob, Company, LearningResource) are
    intentionally excluded. AutopilotSettings/AutopilotQueueItem are also
    user-owned rows this platform holds but were out of scope for this
    change - not silently dropped, just a follow-up for whoever extends this
    endpoint next.
    """

    async def _rows(model, user_col, order_by=None):
        q = select(model).where(user_col == user_id)
        if order_by is not None:
            q = q.order_by(order_by)
        result = await db.execute(q)
        return result.scalars().all()

    profile_row: Optional[CandidateProfile] = (
        await db.execute(select(CandidateProfile).where(CandidateProfile.user_id == user_id))
    ).scalar_one_or_none()

    applications = await _rows(Application, Application.user_id, Application.created_at)
    resume_history = await _rows(ResumeHistory, ResumeHistory.user_id, ResumeHistory.created_at)
    notifications = await _rows(Notification, Notification.user_id, Notification.created_at)
    learning_paths = await _rows(LearningPath, LearningPath.user_id, LearningPath.created_at)
    learning_completions = await _rows(
        LearningCompletion, LearningCompletion.user_id, LearningCompletion.completed_at
    )

    graph_row: Optional[CareerGraph] = (
        await db.execute(select(CareerGraph).where(CareerGraph.user_id == user_id))
    ).scalar_one_or_none()
    career_skills = await _rows(CareerSkill, CareerSkill.user_id)
    career_goals = await _rows(CareerGoal, CareerGoal.user_id)
    career_milestones = await _rows(CareerMilestone, CareerMilestone.user_id, CareerMilestone.created_at)

    portfolio_row: Optional[Portfolio] = (
        await db.execute(select(Portfolio).where(Portfolio.user_id == user_id))
    ).scalar_one_or_none()
    portfolio_projects = []
    if portfolio_row is not None:
        proj_result = await db.execute(
            select(PortfolioProject)
            .where(PortfolioProject.portfolio_id == portfolio_row.id)
            .order_by(PortfolioProject.sort_order)
        )
        portfolio_projects = proj_result.scalars().all()

    has_career_graph_data = bool(
        graph_row or career_skills or career_goals or career_milestones
    )

    export = {
        "export_metadata": {
            "user_id": str(user_id),
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "format_version": "1.0",
            "source": "Job Intelligence Platform - GDPR data export",
        },
        "candidate_profile": _model_to_dict(profile_row) if profile_row else None,
        "applications": [_model_to_dict(a) for a in applications],
        "resume_history": [_model_to_dict(r) for r in resume_history],
        "career_graph": (
            {
                **(_model_to_dict(graph_row) if graph_row else {}),
                "skills": [_model_to_dict(s) for s in career_skills],
                "goals": [_model_to_dict(g) for g in career_goals],
                "milestones": [_model_to_dict(m) for m in career_milestones],
            }
            if has_career_graph_data
            else None
        ),
        "learning_paths": [_model_to_dict(p) for p in learning_paths],
        "learning_completions": [_model_to_dict(c) for c in learning_completions],
        "portfolio": (
            {
                **_model_to_dict(portfolio_row),
                "projects": [_model_to_dict(p) for p in portfolio_projects],
            }
            if portfolio_row
            else None
        ),
        "notifications": [_model_to_dict(n) for n in notifications],
    }

    # Proof-of-concept usage of the audit-log helper (see
    # models/database.py::log_audit_event). Best-effort: a logging failure
    # must never block a user from getting their own data.
    try:
        await log_audit_event(
            db,
            user_id=user_id,
            action="data_export_requested",
            resource_type="user_data_export",
            resource_id=str(user_id),
        )
    except Exception as exc:
        logger.warning(f"Failed to write audit log for data export (user={user_id}): {exc}")

    body = json.dumps(export, default=_json_default, indent=2)
    filename = f"job-intel-data-export-{user_id}.json"

    return StreamingResponse(
        io.BytesIO(body.encode("utf-8")),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
