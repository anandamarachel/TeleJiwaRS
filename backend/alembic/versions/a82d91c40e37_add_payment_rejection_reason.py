"""add payment rejection reason

Revision ID: a82d91c40e37
Revises: f3a6d8e24b51
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a82d91c40e37"
down_revision: Union[str, Sequence[str], None] = "f3a6d8e24b51"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("rejection_reason_code", sa.String(length=50), nullable=True))
    op.add_column("payments", sa.Column("rejection_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "rejection_note")
    op.drop_column("payments", "rejection_reason_code")
