"""add super admin permission

Revision ID: d6a42f8b1c30
Revises: c4e918b7d2f5
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d6a42f8b1c30"
down_revision: Union[str, Sequence[str], None] = "c4e918b7d2f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "admins",
        sa.Column("is_super_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # Bootstrap the earliest existing administrator as Admin Utama.
    op.execute(
        sa.text(
            "UPDATE admins SET is_super_admin = true "
            "WHERE id = (SELECT MIN(id) FROM admins)"
        )
    )
    op.alter_column("admins", "is_super_admin", server_default=None)


def downgrade() -> None:
    op.drop_column("admins", "is_super_admin")
