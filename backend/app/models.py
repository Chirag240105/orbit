from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Memory(Base):
    __tablename__ = "memories"
    id: Mapped[int] = mapped_column(primary_key=True)
    content: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(20), default="fact")
    source: Mapped[str] = mapped_column(String(30), default="user")  # user | chat_suggestion | agent
    confirmed: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(12))  # user | assistant
    content: Mapped[str] = mapped_column(Text)  # user text, or assistant output as JSON string
    skill: Mapped[str | None] = mapped_column(String(60), nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # provider/context info, never file contents
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Workspace(Base):
    __tablename__ = "workspaces"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    path: Mapped[str] = mapped_column(String(1024), unique=True)
    allow_write: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class ProposedChange(Base):
    __tablename__ = "proposed_changes"
    id: Mapped[int] = mapped_column(primary_key=True)
    workspace_id: Mapped[int] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    rel_path: Mapped[str] = mapped_column(String(1024))
    description: Mapped[str] = mapped_column(String(300), default="")
    original_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    new_content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending|applied|rejected|stale
    origin: Mapped[str] = mapped_column(String(10), default="user", server_default="user")  # user | ai
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10), default="todo")  # proposed|todo|doing|done
    priority: Mapped[str] = mapped_column(String(8), default="medium")
    due: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[str] = mapped_column(String(10), default="user")  # user | plan
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class SkillSetting(Base):
    __tablename__ = "skill_settings"
    name: Mapped[str] = mapped_column(String(60), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=_now)
    action: Mapped[str] = mapped_column(String(60))
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
