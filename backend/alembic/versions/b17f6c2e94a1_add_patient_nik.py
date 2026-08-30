"""add patient nik

Revision ID: b17f6c2e94a1
Revises: a82d91c40e37
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b17f6c2e94a1"
down_revision: Union[str, Sequence[str], None] = "a82d91c40e37"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable preserves accounts created before NIK collection was introduced.
    op.add_column("patients", sa.Column("nik", sa.String(length=16), nullable=True))
    op.create_unique_constraint("uq_patients_nik", "patients", ["nik"])


def downgrade() -> None:
    op.drop_constraint("uq_patients_nik", "patients", type_="unique")
    op.drop_column("patients", "nik")
