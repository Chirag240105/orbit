"""Link memories to projects for vision and code context.

Revision ID: d1e2f3a4b5c6
Revises: c30e9a18b2f1
Create Date: 2026-10-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c30e9a18b2f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("memories") as batch:
        batch.add_column(sa.Column("project_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_memories_project_id_projects", "projects", ["project_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_memories_project_id", "memories", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_memories_project_id", table_name="memories")
    with op.batch_alter_table("memories") as batch:
        batch.drop_constraint("fk_memories_project_id_projects", type_="foreignkey")
        batch.drop_column("project_id")
