"""add chat messages

Revision ID: c1f4a9d82e67
Revises: 8c445e5bd50c
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1f4a9d82e67"
down_revision: Union[str, Sequence[str], None] = "8c445e5bd50c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("consultation_id", sa.Integer(), nullable=False),
        sa.Column("sender_user_id", sa.Integer(), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["consultation_id"], ["consultations.id"]),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_chat_messages_consultation_sent_at",
        "chat_messages",
        ["consultation_id", "sent_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_messages_consultation_sent_at", table_name="chat_messages")
    op.drop_table("chat_messages")
