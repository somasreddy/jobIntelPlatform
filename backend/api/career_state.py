"""
Career State API
The shared "career state" read model — a single endpoint other modules
(and other agents) can read from to get a snapshot of a user's profile
summary, skill gaps, fit score, application pipeline, learning progress,
and active goals/milestones, aggregated live from existing tables.

See services/career_state.py for the full aggregation logic and the
design decisions (computed read model vs. synced table; why skill-gap and
fit-score reuse existing logic instead of inventing new formulas).
"""
import uuid
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.auth import get_current_user_id
from services.career_state import get_career_state

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def read_career_state(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Return the aggregated career-state read model for the current user.
    Auth-scoped via get_current_user_id, matching this codebase's existing
    convention (see api/career_graph.py, api/learning.py, api/applications.py).
    """
    return await get_career_state(user_id, db)
