"""Accounts, sessions and listing ownership."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(80), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(256), nullable=False),
    )
    op.create_table(
        "login_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires", sa.Integer(), nullable=False),
    )
    # Existing listings remain public, but cannot be claimed by strangers.
    op.add_column(
        "cars", sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"))
    )


def downgrade():
    op.drop_column("cars", "owner_id")
    op.drop_table("login_sessions")
    op.drop_table("users")
