from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260926_09"
down_revision: str | None = "20260926_08"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "annual_plan_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "session_id",
            sa.Uuid(),
            sa.ForeignKey("anonymous_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("structured_input", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_annual_plan_runs_session_id", "annual_plan_runs", ["session_id"])


def downgrade() -> None:
    op.drop_table("annual_plan_runs")
