"""Create simple recommendation feedback.

Revision ID: 20260925_04
Revises: 20260925_03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260925_04"
down_revision: str | None = "20260925_03"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "feedback",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "session_id",
            sa.Uuid(),
            sa.ForeignKey("anonymous_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recommendation_id",
            sa.Uuid(),
            sa.ForeignKey("recommendations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("value", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("session_id", "recommendation_id"),
    )
    op.create_index("ix_feedback_recommendation_id", "feedback", ["recommendation_id"])


def downgrade() -> None:
    op.drop_index("ix_feedback_recommendation_id", table_name="feedback")
    op.drop_table("feedback")
