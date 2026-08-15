"""Audit log (GDPR-friendly data export + audit trail)

Adds a single new append-only table, `audit_logs`, used to record
security/privacy-relevant actions a user (or the system on their behalf)
took - e.g. "requested a GDPR data export". Generic action/resource_type/
resource_id columns plus a JSONB bag for anything else, matching this
schema's existing convention for open-ended event data (see
notifications.extra_data).

This migration does not touch any existing table. The only current writer
is the new GET /api/data-export/ endpoint (backend/api/data_export.py),
which calls models.database.log_audit_event() to record a
"data_export_requested" row as a proof of concept - retrofitting audit
logging into other endpoints is a deliberate follow-up, not done here.

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100), nullable=True),
        sa.Column("resource_id", sa.String(255), nullable=True),
        sa.Column("extra_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"], unique=False)
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"], unique=False)
    op.create_index("ix_audit_logs_user_action", "audit_logs", ["user_id", "action"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_audit_logs_user_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")
