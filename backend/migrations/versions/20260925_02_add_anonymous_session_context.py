"""Add resumable anonymous session context.

Revision ID: 20260925_02
Revises: 20260924_01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260925_02"
down_revision: str | None = "20260924_01"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "anonymous_sessions",
        sa.Column("balance_days", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "anonymous_sessions",
        sa.Column("allowed_negative_days", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "anonymous_sessions",
        sa.Column("country_code", sa.String(length=2), nullable=False, server_default="IL"),
    )
    op.add_column(
        "anonymous_sessions",
        sa.Column("weekend_days", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.alter_column("anonymous_sessions", "balance_days", server_default=None)
    op.alter_column("anonymous_sessions", "allowed_negative_days", server_default=None)
    op.alter_column("anonymous_sessions", "country_code", server_default=None)
    op.alter_column("anonymous_sessions", "weekend_days", server_default=None)


def downgrade() -> None:
    op.drop_column("anonymous_sessions", "weekend_days")
    op.drop_column("anonymous_sessions", "country_code")
    op.drop_column("anonymous_sessions", "allowed_negative_days")
    op.drop_column("anonymous_sessions", "balance_days")
