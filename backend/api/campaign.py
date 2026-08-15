"""
Campaign router — job search campaign management.
A Campaign represents a structured, goal-oriented job search with:
  - Target role, salary, location, and timeline
  - Daily action goals (applications, evaluations, outreaches)
  - Progress tracking and streak counting
  - AI-generated daily todos
"""
import uuid
import json
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from core.database import get_db
from core.auth import get_current_user_id
from core.llm import smart_chat
from models.database import Application
from services.application_status import normalize_application_status

logger = logging.getLogger(__name__)
router = APIRouter()

# ── DB helpers (create table on demand — avoids needing Alembic migration) ────
_CREATE_CAMPAIGNS_SQL = """
CREATE TABLE IF NOT EXISTS campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    name                TEXT NOT NULL DEFAULT 'My Job Search',
    target_role         TEXT,
    target_salary_min   INTEGER,
    target_salary_max   INTEGER,
    target_currency     TEXT DEFAULT 'USD',
    target_location     TEXT,
    work_mode           TEXT DEFAULT 'hybrid',
    deadline_date       DATE,
    daily_goal_apply    INTEGER DEFAULT 3,
    daily_goal_evaluate INTEGER DEFAULT 5,
    daily_goal_outreach INTEGER DEFAULT 2,
    current_streak      INTEGER DEFAULT 0,
    longest_streak      INTEGER DEFAULT 0,
    last_active_date    DATE,
    status              TEXT DEFAULT 'active',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
)
"""

_CREATE_CAMPAIGNS_INDEX_SQL = (
    "CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id)"
)

_CREATE_ACTIONS_SQL = """
CREATE TABLE IF NOT EXISTS campaign_actions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL,
    action_type  TEXT NOT NULL,
    action_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    count        INTEGER DEFAULT 1,
    metadata     JSONB,
    created_at   TIMESTAMPTZ DEFAULT NOW()
)
"""

_CREATE_ACTIONS_INDEX_SQL = (
    "CREATE INDEX IF NOT EXISTS idx_campaign_actions_cid "
    "ON campaign_actions(campaign_id, action_date)"
)


async def _ensure_tables(db: AsyncSession) -> None:
    # asyncpg prepares each SQLAlchemy text() execution and therefore requires
    # exactly one PostgreSQL command per call (especially through Supavisor).
    for statement in (
        _CREATE_CAMPAIGNS_SQL,
        _CREATE_CAMPAIGNS_INDEX_SQL,
        _CREATE_ACTIONS_SQL,
        _CREATE_ACTIONS_INDEX_SQL,
    ):
        await db.execute(text(statement))
    await db.flush()


async def _get_campaign(db: AsyncSession, campaign_id: uuid.UUID, user_id: uuid.UUID) -> dict | None:
    row = await db.execute(
        text("SELECT * FROM campaigns WHERE id = :id AND user_id = :uid"),
        {"id": str(campaign_id), "uid": str(user_id)},
    )
    r = row.mappings().first()
    return dict(r) if r else None


async def _get_active_campaign(db: AsyncSession, user_id: uuid.UUID) -> dict | None:
    row = await db.execute(
        text("SELECT * FROM campaigns WHERE user_id = :uid AND status = 'active' ORDER BY created_at DESC LIMIT 1"),
        {"uid": str(user_id)},
    )
    r = row.mappings().first()
    return dict(r) if r else None


# ── Schemas ───────────────────────────────────────────────────────────────────
class CampaignCreate(BaseModel):
    name: str = "My Job Search"
    target_role: Optional[str] = None
    target_salary_min: Optional[int] = None
    target_salary_max: Optional[int] = None
    target_currency: str = "USD"
    target_location: Optional[str] = None
    work_mode: str = "hybrid"
    deadline_date: Optional[str] = None  # ISO date string
    daily_goal_apply: int = 3
    daily_goal_evaluate: int = 5
    daily_goal_outreach: int = 2


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/", status_code=201)
async def create_campaign(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Create a new job search campaign."""
    await _ensure_tables(db)
    cid = uuid.uuid4()
    await db.execute(
        text("""
            INSERT INTO campaigns
              (id, user_id, name, target_role, target_salary_min, target_salary_max,
               target_currency, target_location, work_mode, deadline_date,
               daily_goal_apply, daily_goal_evaluate, daily_goal_outreach)
            VALUES
              (:id, :uid, :name, :role, :sal_min, :sal_max, :currency, :location,
               :work_mode, :deadline, :g_apply, :g_eval, :g_out)
        """),
        {
            "id": str(cid), "uid": str(uid),
            "name": payload.name, "role": payload.target_role,
            "sal_min": payload.target_salary_min, "sal_max": payload.target_salary_max,
            "currency": payload.target_currency, "location": payload.target_location,
            "work_mode": payload.work_mode, "deadline": payload.deadline_date,
            "g_apply": payload.daily_goal_apply,
            "g_eval": payload.daily_goal_evaluate,
            "g_out": payload.daily_goal_outreach,
        },
    )
    await db.flush()
    return {"id": str(cid), "status": "active", "name": payload.name}


@router.get("/active")
async def get_active_campaign(
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Get the user's current active campaign with today's progress."""
    await _ensure_tables(db)
    campaign = await _get_active_campaign(db, uid)
    if not campaign:
        return {"campaign": None, "message": "No active campaign — create one to start tracking"}

    cid = campaign["id"]
    today = date.today().isoformat()

    # Today's action counts
    actions = await db.execute(
        text("""
            SELECT action_type, SUM(count) as total
            FROM campaign_actions
            WHERE campaign_id = :cid AND action_date = :today
            GROUP BY action_type
        """),
        {"cid": str(cid), "today": today},
    )
    today_actions = {r["action_type"]: r["total"] for r in actions.mappings()}

    # Overall application stats
    apps_result = await db.execute(
        select(Application).where(Application.user_id == uid)
    )
    apps = apps_result.scalars().all()
    total_apps    = len(apps)
    interviews    = sum(1 for a in apps if normalize_application_status(a.status, strict=False) in ("interview", "offer"))
    offers        = sum(1 for a in apps if normalize_application_status(a.status, strict=False) == "offer")

    # Streak calculation
    streak = campaign.get("current_streak", 0)
    last_active = campaign.get("last_active_date")
    if last_active:
        last_date = last_active if isinstance(last_active, date) else date.fromisoformat(str(last_active)[:10])
        if (date.today() - last_date).days > 1:
            streak = 0  # streak broken

    # Days remaining
    days_remaining = None
    deadline = campaign.get("deadline_date")
    if deadline:
        dl_date = deadline if isinstance(deadline, date) else date.fromisoformat(str(deadline)[:10])
        days_remaining = (dl_date - date.today()).days

    return {
        "campaign": {
            "id":               str(cid),
            "name":             campaign["name"],
            "target_role":      campaign["target_role"],
            "target_salary":    f"{campaign['target_currency']} {campaign['target_salary_min']:,}-{campaign['target_salary_max']:,}" if campaign.get("target_salary_min") else None,
            "target_location":  campaign["target_location"],
            "work_mode":        campaign["work_mode"],
            "days_remaining":   days_remaining,
            "current_streak":   streak,
            "longest_streak":   campaign.get("longest_streak", 0),
        },
        "today_progress": {
            "applications_sent":   today_actions.get("apply", 0),
            "applications_goal":   campaign["daily_goal_apply"],
            "evaluations_done":    today_actions.get("evaluate", 0),
            "evaluations_goal":    campaign["daily_goal_evaluate"],
            "outreaches_sent":     today_actions.get("outreach", 0),
            "outreaches_goal":     campaign["daily_goal_outreach"],
        },
        "pipeline_summary": {
            "total_applications": total_apps,
            "interviews":         interviews,
            "offers":             offers,
        },
    }


@router.post("/{campaign_id}/log-action")
async def log_action(
    campaign_id: str,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """
    Log a daily action to the campaign.
    action_type: 'apply' | 'evaluate' | 'outreach' | 'interview_prep' | 'follow_up'
    """
    await _ensure_tables(db)
    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid campaign_id")

    campaign = await _get_campaign(db, cid, uid)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    action_type = payload.get("action_type")
    valid_types = ("apply", "evaluate", "outreach", "interview_prep", "follow_up")
    if action_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"action_type must be one of {valid_types}")

    count = max(1, int(payload.get("count", 1)))
    today = date.today().isoformat()

    # Upsert action count for today
    await db.execute(
        text("""
            INSERT INTO campaign_actions (id, campaign_id, user_id, action_type, action_date, count)
            VALUES (gen_random_uuid(), :cid, :uid, :atype, :today, :count)
            ON CONFLICT DO NOTHING
        """),
        {"cid": str(cid), "uid": str(uid), "atype": action_type, "today": today, "count": count},
    )

    # Update streak
    last_active = campaign.get("last_active_date")
    streak = int(campaign.get("current_streak", 0))
    longest = int(campaign.get("longest_streak", 0))

    if last_active:
        last_date = last_active if isinstance(last_active, date) else date.fromisoformat(str(last_active)[:10])
        diff = (date.today() - last_date).days
        if diff == 1:
            streak += 1
        elif diff == 0:
            pass  # Same day, no change
        else:
            streak = 1  # Reset
    else:
        streak = 1

    longest = max(longest, streak)
    await db.execute(
        text("""
            UPDATE campaigns
            SET current_streak = :streak, longest_streak = :longest,
                last_active_date = :today, updated_at = NOW()
            WHERE id = :cid
        """),
        {"streak": streak, "longest": longest, "today": today, "cid": str(cid)},
    )
    await db.flush()

    return {"logged": action_type, "count": count, "current_streak": streak}


@router.get("/{campaign_id}/daily-todos")
async def get_daily_todos(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    uid: uuid.UUID = Depends(get_current_user_id),
):
    """Get AI-generated daily action items for the campaign."""
    await _ensure_tables(db)
    try:
        cid = uuid.UUID(campaign_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid campaign_id")

    campaign = await _get_campaign(db, cid, uid)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Get pipeline state
    apps_result = await db.execute(select(Application).where(Application.user_id == uid))
    apps = apps_result.scalars().all()
    total_apps = len(apps)
    interviews = sum(1 for a in apps if normalize_application_status(a.status, strict=False) == "interview")
    saved      = sum(1 for a in apps if normalize_application_status(a.status, strict=False) == "saved")

    system = (
        "You are a daily job search coach. Based on the campaign state, generate 5-7 specific, "
        "actionable daily todos that move the candidate toward their goal. "
        "Be concrete — not 'apply to jobs' but 'Apply to the 3 saved jobs in your pipeline'. "
        "Return ONLY valid JSON: "
        '{ "todos": [{ "task": "...", "type": "apply|evaluate|outreach|prep|admin", '
        '"priority": "high|medium|low", "time_minutes": 15 }], "motivation": "..." }'
    )
    user_msg = (
        f"Campaign goal: {campaign.get('target_role','?')} | "
        f"Deadline: {campaign.get('deadline_date','not set')} | "
        f"Pipeline: {total_apps} total applications, {saved} saved & waiting, {interviews} active interviews\n"
        f"Daily goals: {campaign['daily_goal_apply']} applications, "
        f"{campaign['daily_goal_evaluate']} evaluations, {campaign['daily_goal_outreach']} outreaches\n"
        f"Current streak: {campaign.get('current_streak',0)} days"
    )

    raw  = await smart_chat(system, user_msg, max_tokens=800, temperature=0.5, task_type="coaching")
    import re
    text = raw.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'\s*```$', '', text, flags=re.MULTILINE)
    try:
        result = json.loads(text.strip())
    except Exception:
        result = {
            "todos": [
                {"task": f"Evaluate {campaign['daily_goal_evaluate']} saved jobs using the 6-block framework", "type": "evaluate", "priority": "high", "time_minutes": 30},
                {"task": f"Apply to {campaign['daily_goal_apply']} top-scored jobs", "type": "apply", "priority": "high", "time_minutes": 45},
                {"task": f"Send {campaign['daily_goal_outreach']} personalized recruiter messages", "type": "outreach", "priority": "medium", "time_minutes": 20},
                {"task": "Add 1 new STAR story to your interview story bank", "type": "prep", "priority": "medium", "time_minutes": 15},
                {"task": "Follow up on applications older than 7 days with no response", "type": "admin", "priority": "low", "time_minutes": 10},
            ],
            "motivation": "Consistency beats intensity — even 2 hours a day compounds into results.",
        }

    return result
