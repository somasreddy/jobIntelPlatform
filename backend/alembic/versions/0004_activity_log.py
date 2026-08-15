"""Pipeline activity log (additive)

Adds a single new table, `activity_log`, backing the activity timeline on
the Pipeline page (frontend/app/applications/page.tsx) — real logged events
for status changes, follow-up set/cleared/completed, note updates, and the
"reminder_sent" events written by the follow-up-reminder check in
backend/api/activity_log.py.

`application_id` is a real FK to `applications.id` with ON DELETE CASCADE
(deleting an application, e.g. via DELETE /api/applications/{id}, cleanly
removes its activity rows instead of failing on a dangling reference).
`contact_id` is a plain nullable UUID column with NO foreign key — Outreach
CRM contacts are a client-side-only concept today (kept in the browser's
localStorage from frontend/app/applications/page.tsx; there is no
`contacts` table anywhere in this schema, and contact ids are short random
strings, not UUIDs), so a real FK here would be fabricated. This column
exists so a future backend-backed Contacts model can start writing rows
without another migration.

This migration does not touch any existing table.

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-15

Note on revision numbering: the original task spec for this feature asked
for revision "0003" chained onto "0002". By the time this migration was
written, another concurrent change had already claimed 0003 for an unrelated
audit_log table (see 0003_audit_log.py) — this file chains onto that actual
current head (0003) instead, since re-using "0003" would either collide on
a duplicate revision id or fork the migration history into two heads.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.create_table(
        "activity_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "application_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=True,
        ),
        # No ForeignKey - see module docstring: no `contacts` table exists yet.
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("extra_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_activity_log_user_id", "activity_log", ["user_id"], unique=False)
    op.create_index("ix_activity_log_application_id", "activity_log", ["application_id"], unique=False)
    op.create_index("ix_activity_log_contact_id", "activity_log", ["contact_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_activity_log_contact_id", table_name="activity_log")
    op.drop_index("ix_activity_log_application_id", table_name="activity_log")
    op.drop_index("ix_activity_log_user_id", table_name="activity_log")
    op.drop_table("activity_log")
