from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260926_08"
down_revision: str | None = "20260926_07"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("searches", sa.Column("opportunities", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("searches", "opportunities")
