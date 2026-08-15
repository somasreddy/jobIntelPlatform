"""Interview Prep spaced-repetition review state (additive)

Adds `question_review_states` - one row per (user, question) tracked by the
Interview Prep "Due for Review" queue (frontend/app/interview/page.tsx) and
the Leitner-style leveled interval scheduler in
backend/interview_coach/spaced_repetition.py.

Purely additive: a new table only, no existing schema touched. `question_id`
is a plain string (not a FK) because questions can come from the static
frontend question bank, a profile-personalised generated set, or an
LLM-generated JD-specific set - none of which are backed by a DB table.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "question_review_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("question_id", sa.String(255), nullable=False),
        sa.Column("question_domain", sa.String(100), nullable=True),
        sa.Column("question_type", sa.String(50), nullable=True),
        sa.Column("question_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("box", sa.Integer(), nullable=False),
        sa.Column("repetitions", sa.Integer(), nullable=False),
        sa.Column("correct_streak", sa.Integer(), nullable=False),
        sa.Column("last_grade", sa.String(20), nullable=True),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_question_review_states_user_id", "question_review_states", ["user_id"], unique=False
    )
    op.create_index(
        "ix_question_review_states_user_question",
        "question_review_states", ["user_id", "question_id"], unique=True,
    )
    op.create_index(
        "ix_question_review_states_user_due",
        "question_review_states", ["user_id", "next_review_at"], unique=False,
    )
    op.create_index(
        "ix_question_review_states_next_review_at",
        "question_review_states", ["next_review_at"], unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_question_review_states_next_review_at", table_name="question_review_states")
    op.drop_index("ix_question_review_states_user_due", table_name="question_review_states")
    op.drop_index("ix_question_review_states_user_question", table_name="question_review_states")
    op.drop_index("ix_question_review_states_user_id", table_name="question_review_states")
    op.drop_table("question_review_states")
