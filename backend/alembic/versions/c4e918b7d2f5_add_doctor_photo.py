"""add doctor photo

Revision ID: c4e918b7d2f5
Revises: b17f6c2e94a1
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4e918b7d2f5"
down_revision: Union[str, Sequence[str], None] = "b17f6c2e94a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("doctors", sa.Column("photo_file_path", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("doctors", "photo_file_path")
