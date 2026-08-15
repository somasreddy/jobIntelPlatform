"""Multi-tenancy & RBAC schema (additive, not enforced)

Adds the groundwork for workspace-scoped, role-based access control without
changing any existing behavior:

- A new `tenants` table (workspace/organization concept: id, name, slug,
  owner_user_id, is_active, created_at, updated_at).
- A nullable `tenant_id` FK (-> tenants.id) added to the core user-owned
  tables: `candidate_profiles`, `applications`, `resume_history`.
- A nullable `role` string column added to `candidate_profiles`
  (owner | admin | member | viewer), chosen over a separate Role/Permission
  table pair since nothing in the existing schema signals a need for
  fine-grained per-permission control yet (see the PHASE 8 comment block in
  backend/models/database.py for the full rationale).

All new columns are nullable and unindexed by any query today - no
dependency, router, or service reads tenant_id or role anywhere yet.
Backfilling tenant_id on existing rows and actually enforcing role/tenant
checks on requests are deliberate follow-up decisions for later, not made
by this migration.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # ── New: tenants (workspace/organization) ───────────────────────────
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_tenants_owner_user_id", "tenants", ["owner_user_id"], unique=False)

    # ── candidate_profiles: + tenant_id, + role ──────────────────────────
    op.add_column(
        "candidate_profiles",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=True),
    )
    op.create_index(
        "ix_candidate_profiles_tenant_id", "candidate_profiles", ["tenant_id"], unique=False
    )
    op.add_column(
        "candidate_profiles",
        sa.Column("role", sa.String(20), nullable=True),
    )

    # ── applications: + tenant_id ─────────────────────────────────────────
    op.add_column(
        "applications",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=True),
    )
    op.create_index("ix_applications_tenant_id", "applications", ["tenant_id"], unique=False)

    # ── resume_history: + tenant_id ───────────────────────────────────────
    op.add_column(
        "resume_history",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=True),
    )
    op.create_index("ix_resume_history_tenant_id", "resume_history", ["tenant_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Reverse order: drop FK-bearing columns on child tables before dropping
    # the tenants table they reference.
    op.drop_index("ix_resume_history_tenant_id", table_name="resume_history")
    op.drop_column("resume_history", "tenant_id")

    op.drop_index("ix_applications_tenant_id", table_name="applications")
    op.drop_column("applications", "tenant_id")

    op.drop_column("candidate_profiles", "role")
    op.drop_index("ix_candidate_profiles_tenant_id", table_name="candidate_profiles")
    op.drop_column("candidate_profiles", "tenant_id")

    op.drop_index("ix_tenants_owner_user_id", table_name="tenants")
    op.drop_table("tenants")
