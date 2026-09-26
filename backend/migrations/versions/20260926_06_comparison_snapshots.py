"""Store complete comparison snapshots separately from Search."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260926_06"
down_revision: str | None = "20260926_05"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "comparisons",
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
    op.create_index("ix_comparisons_session_id", "comparisons", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_comparisons_session_id", table_name="comparisons")
    op.drop_table("comparisons")
