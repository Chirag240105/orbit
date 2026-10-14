from datetime import date, datetime, timezone
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator


def _utc(d: datetime) -> str:
    return (d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d).isoformat()


UtcDt = Annotated[datetime, PlainSerializer(_utc, return_type=str)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


MemType = Literal["fact", "preference", "project", "other"]


class MemoryIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    type: MemType = "fact"
    source: Literal["user", "chat_suggestion"] = "user"


class MemoryPatch(BaseModel):
    content: str | None = Field(None, min_length=1, max_length=2000)
    type: MemType | None = None
    confirmed: bool | None = None


class MemoryOut(ORM):
    id: int
    content: str
    type: str
    source: str
    confirmed: bool
    created_at: UtcDt
    updated_at: UtcDt


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: int | None = None
    skill: str | None = None
    workspace_id: int | None = None
    file_paths: list[str] = Field(default_factory=list, max_length=5)
    consent_external: bool = False


class ProviderInfo(BaseModel):
    name: str
    model: str
    is_demo: bool


class ContextUsed(BaseModel):
    memory_ids: list[int] = []
    files: list[str] = []
    chars_sent: int = 0
    redactions: int = 0
    external: bool = False


class ProposedTask(BaseModel):
    title: str
    priority: str = "medium"
    notes: str = ""

    @field_validator("priority")
    @classmethod
    def _norm(cls, v: str) -> str:
        return v if v in ("high", "medium", "low") else "medium"


class ChatResponse(BaseModel):
    conversation_id: int
    message_id: int
    skill: str
    output: dict[str, Any]
    provider: ProviderInfo
    context: ContextUsed
    proposed_tasks: list[ProposedTask] = []
    warnings: list[str] = []


class ConversationOut(ORM):
    id: int
    title: str
    updated_at: UtcDt


class MessageOut(BaseModel):
    id: int
    role: str
    content: str | dict[str, Any]
    skill: str | None
    meta: dict[str, Any] | None
    created_at: UtcDt


class SkillOut(BaseModel):
    name: str
    title: str
    description: str
    required_permissions: list[str]
    requires_files: bool
    enabled: bool
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]


class SkillPatch(BaseModel):
    enabled: bool


class WorkspaceIn(BaseModel):
    path: str = Field(min_length=1, max_length=1024)
    name: str | None = Field(None, max_length=80)


class WorkspacePatch(BaseModel):
    allow_write: bool


class WorkspaceOut(ORM):
    id: int
    name: str
    path: str
    allow_write: bool
    created_at: UtcDt


class ProposeChangeIn(BaseModel):
    path: str = Field(min_length=1, max_length=500)
    new_content: str = Field(max_length=500_000)
    description: str = Field("", max_length=300)


class ChangeOut(ORM):
    id: int
    workspace_id: int
    rel_path: str
    description: str
    original_content: str | None
    new_content: str
    status: str
    created_at: UtcDt
    decided_at: UtcDt | None


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str = Field("", max_length=4000)
    status: Literal["proposed", "todo", "doing", "done"] = "todo"
    priority: Literal["high", "medium", "low"] = "medium"
    due: date | None = None
    source: Literal["user", "plan"] = "user"


class TaskPatch(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    notes: str | None = Field(None, max_length=4000)
    status: Literal["proposed", "todo", "doing", "done"] | None = None
    priority: Literal["high", "medium", "low"] | None = None
    due: date | None = None


class TaskOut(ORM):
    id: int
    title: str
    notes: str
    status: str
    priority: str
    due: date | None
    source: str
    created_at: UtcDt
