"""Create immutable search and recommendation snapshots.

Revision ID: 20260925_03
Revises: 20260925_02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260925_03"
down_revision: str | None = "20260925_02"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "searches",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "session_id",
            sa.Uuid(),
            sa.ForeignKey("anonymous_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("engine_version", sa.String(length=100), nullable=False),
        sa.Column("structured_input", sa.JSON(), nullable=False),
        sa.Column("source_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_searches_session_id", "searches", ["session_id"])
    op.create_table(
        "recommendations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "search_id",
            sa.Uuid(),
            sa.ForeignKey("searches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("warnings", sa.JSON(), nullable=False),
        sa.UniqueConstraint("search_id", "rank"),
    )
    op.create_index("ix_recommendations_search_id", "recommendations", ["search_id"])


def downgrade() -> None:
    op.drop_index("ix_recommendations_search_id", table_name="recommendations")
    op.drop_table("recommendations")
    op.drop_index("ix_searches_session_id", table_name="searches")
    op.drop_table("searches")
