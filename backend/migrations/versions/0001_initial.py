"""initial schema (the tables ORBIT 0.1 created with create_all)

Revision ID: 0001
Revises:
Create Date: 2026-10-15
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "memories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("source", sa.String(30), nullable=False),
        sa.Column("confirmed", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("conversation_id", sa.Integer(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(12), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("skill", sa.String(60), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "workspaces",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("path", sa.String(1024), nullable=False, unique=True),
        sa.Column("allow_write", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "proposed_changes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workspace_id", sa.Integer(), sa.ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rel_path", sa.String(1024), nullable=False),
        sa.Column("description", sa.String(300), nullable=False),
        sa.Column("original_content", sa.Text(), nullable=True),
        sa.Column("base_hash", sa.String(64), nullable=True),
        sa.Column("new_content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(12), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("priority", sa.String(8), nullable=False),
        sa.Column("due", sa.Date(), nullable=True),
        sa.Column("source", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "skill_settings",
        sa.Column("name", sa.String(60), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ts", sa.DateTime(), nullable=False),
        sa.Column("action", sa.String(60), nullable=False),
        sa.Column("detail", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    for table in ("audit_log", "skill_settings", "tasks", "proposed_changes", "workspaces", "messages", "conversations", "memories"):
        op.drop_table(table)
