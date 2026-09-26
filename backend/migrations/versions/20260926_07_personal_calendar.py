"""Persist immutable personal calendar context with an empty legacy default."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260926_07"
down_revision: str | None = "20260926_06"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "anonymous_sessions",
        sa.Column("personal_calendar", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )


def downgrade() -> None:
    op.drop_column("anonymous_sessions", "personal_calendar")
