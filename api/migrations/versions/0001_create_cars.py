"""Create the cars table and its data constraints."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cars",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("make", sa.String(80), nullable=False),
        sa.Column("model", sa.String(80), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("milage", sa.Integer(), nullable=False),
        sa.CheckConstraint("length(trim(make)) > 0", name="car_make_not_blank"),
        sa.CheckConstraint("length(trim(model)) > 0", name="car_model_not_blank"),
        sa.CheckConstraint("year BETWEEN 1886 AND 2100", name="car_year_range"),
        sa.CheckConstraint("price >= 0", name="car_price_nonnegative"),
        sa.CheckConstraint("milage >= 0", name="car_milage_nonnegative"),
    )


def downgrade() -> None:
    op.drop_table("cars")
