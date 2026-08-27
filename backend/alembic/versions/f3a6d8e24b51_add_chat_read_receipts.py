"""add chat read receipts

Revision ID: f3a6d8e24b51
Revises: e7b2c4d91a30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3a6d8e24b51"
down_revision: Union[str, Sequence[str], None] = "e7b2c4d91a30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("chat_messages", sa.Column("read_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_messages", "read_at")
