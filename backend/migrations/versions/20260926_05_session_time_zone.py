"""Add effective local-date zone with a supported-calendar fallback."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260926_05"
down_revision: str | None = "20260925_04"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "anonymous_sessions",
        sa.Column("time_zone", sa.Text(), nullable=False, server_default="Asia/Jerusalem"),
    )


def downgrade() -> None:
    op.drop_column("anonymous_sessions", "time_zone")
