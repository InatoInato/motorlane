"""Add an optional cover photo key to car listings."""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cars", sa.Column("photo_key", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("cars", "photo_key")
