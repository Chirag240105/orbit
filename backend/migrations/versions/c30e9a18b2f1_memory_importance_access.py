"""Add memory importance and access tracking.

Revision ID: c30e9a18b2f1
Revises: 227bcbe8eb55
Create Date: 2026-10-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c30e9a18b2f1"
down_revision: Union[str, None] = "227bcbe8eb55"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("memories", sa.Column("importance", sa.Float(), server_default="0.5", nullable=False))
    op.add_column("memories", sa.Column("last_accessed", sa.DateTime(), nullable=True))
    op.execute(sa.text("UPDATE memories SET last_accessed = created_at WHERE last_accessed IS NULL"))
    with op.batch_alter_table("memories") as batch:
        batch.alter_column("last_accessed", existing_type=sa.DateTime(), nullable=False)
    op.execute(sa.text("UPDATE memories SET type = 'USER' WHERE type = 'fact'"))
    op.execute(sa.text("UPDATE memories SET type = 'PREFERENCE' WHERE type = 'preference'"))
    op.execute(sa.text("UPDATE memories SET type = 'PROJECT' WHERE type = 'project'"))
    op.execute(sa.text("UPDATE memories SET type = 'USER' WHERE type = 'other'"))


def downgrade() -> None:
    op.drop_column("memories", "last_accessed")
    op.drop_column("memories", "importance")
