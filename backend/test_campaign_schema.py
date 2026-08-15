"""Regression coverage for asyncpg-compatible campaign schema bootstrap."""
from __future__ import annotations

import asyncio

from api.campaign import _ensure_tables


class _RecordingSession:
    def __init__(self) -> None:
        self.statements: list[str] = []
        self.flushed = False

    async def execute(self, statement):
        self.statements.append(str(statement).strip())

    async def flush(self) -> None:
        self.flushed = True


def test_campaign_schema_uses_one_command_per_execute() -> None:
    session = _RecordingSession()

    asyncio.run(_ensure_tables(session))

    assert session.flushed is True
    assert len(session.statements) == 4
    assert all(statement.rstrip(";").count(";") == 0 for statement in session.statements)
    assert session.statements[0].startswith("CREATE TABLE IF NOT EXISTS campaigns")
    assert session.statements[1].startswith("CREATE INDEX IF NOT EXISTS idx_campaigns_user")
    assert session.statements[2].startswith("CREATE TABLE IF NOT EXISTS campaign_actions")
    assert session.statements[3].startswith("CREATE INDEX IF NOT EXISTS idx_campaign_actions_cid")
