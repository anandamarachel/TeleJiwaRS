"""add patient profile change audit

Revision ID: e91b7a3c5d24
Revises: d6a42f8b1c30
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e91b7a3c5d24"
down_revision: Union[str, Sequence[str], None] = "d6a42f8b1c30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "patient_profile_changes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("field_name", sa.String(length=50), nullable=False),
        sa.Column("old_value_masked", sa.String(length=255), nullable=True),
        sa.Column("new_value_masked", sa.String(length=255), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_patient_profile_changes_patient_id", "patient_profile_changes", ["patient_id"])


def downgrade() -> None:
    op.drop_index("ix_patient_profile_changes_patient_id", table_name="patient_profile_changes")
    op.drop_table("patient_profile_changes")
