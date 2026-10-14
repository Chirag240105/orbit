"""record whether a proposed change was written by the user or drafted by AI

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-15
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("proposed_changes") as batch:
        batch.add_column(sa.Column("origin", sa.String(10), nullable=False, server_default="user"))


def downgrade() -> None:
    with op.batch_alter_table("proposed_changes") as batch:
        batch.drop_column("origin")
