"""use wall-clock timestamps for chat messages

Revision ID: e7b2c4d91a30
Revises: c1f4a9d82e67
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7b2c4d91a30"
down_revision: Union[str, Sequence[str], None] = "c1f4a9d82e67"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "chat_messages",
        "sent_at",
        server_default=sa.text("clock_timestamp()"),
    )


def downgrade() -> None:
    op.alter_column(
        "chat_messages",
        "sent_at",
        server_default=sa.text("now()"),
    )
