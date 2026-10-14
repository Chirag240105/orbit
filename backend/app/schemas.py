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
    type: MemType
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
    layout: bool = False  # the workspace summary (file names, dependency names) was included
    chars_sent: int = 0
    redactions: int = 0
    external: bool = False
    routing: str | None = None  # explicit | model | keywords | default


Priority = Literal["high", "medium", "low"]


class ProposedTask(BaseModel):
    title: str
    priority: Priority = "medium"
    notes: str = ""

    @field_validator("priority", mode="before")
    @classmethod
    def _norm(cls, v: object) -> str:
        return v if v in ("high", "medium", "low") else "medium"  # type: ignore[return-value]


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
    role: Literal["user", "assistant"]
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
    uses_workspace_summary: bool
    invocation: Literal["chat", "workflow"]
    enabled: bool
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]


class SkillPatch(BaseModel):
    enabled: bool


class SkillToggleOut(BaseModel):
    name: str
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


ChangeStatus = Literal["pending", "applied", "rejected", "stale"]


class ChangeOut(ORM):
    id: int
    workspace_id: int
    rel_path: str
    description: str
    original_content: str | None
    new_content: str
    status: ChangeStatus
    origin: Literal["user", "ai"]
    created_at: UtcDt
    decided_at: UtcDt | None


TaskStatus = Literal["proposed", "todo", "doing", "done"]


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str = Field("", max_length=4000)
    status: TaskStatus = "todo"
    priority: Priority = "medium"
    due: date | None = None
    source: Literal["user", "plan"] = "user"


class TaskPatch(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    notes: str | None = Field(None, max_length=4000)
    status: TaskStatus | None = None
    priority: Priority | None = None
    due: date | None = None


class TaskOut(ORM):
    id: int
    title: str
    notes: str
    status: TaskStatus
    priority: Priority
    due: date | None
    source: Literal["user", "plan"]
    created_at: UtcDt


# ---------- health and settings ----------
class ProviderStatus(BaseModel):
    name: str
    model: str
    configured: bool
    is_demo: bool


class HealthProvider(ProviderStatus):
    demo_mode: bool


class HealthOut(BaseModel):
    status: Literal["ok"]
    version: str
    database: Literal["ok"]
    provider: HealthProvider


class SettingsProvider(ProviderStatus):
    hosted: bool


class Limits(BaseModel):
    max_file_bytes: int
    max_context_chars: int


class ToolInfo(BaseModel):
    name: str
    description: str
    permissions: list[str]
    requires_confirmation: bool


class SettingsOut(BaseModel):
    provider: SettingsProvider
    limits: Limits
    model_routing: bool
    tools: list[ToolInfo]
    privacy: list[str]


# ---------- workspace inspection ----------
class FileEntry(BaseModel):
    path: str
    size: int


class SearchHit(BaseModel):
    path: str
    line: int | None
    snippet: str | None


class FileSuggestion(BaseModel):
    path: str
    score: float
    reasons: list[str]


class FileContent(BaseModel):
    path: str
    content: str


class WorkspaceSummary(BaseModel):
    file_count: int
    by_extension: dict[str, int]
    top_level_folders: dict[str, int]
    config_files: list[str]
    dependencies: dict[str, list[str]]
    note: str


# ---------- agent workflows ----------
class ProjectNotesIn(BaseModel):
    goal: str = Field(min_length=3, max_length=2000)
    file_paths: list[str] = Field(default_factory=list, max_length=8)
    notes_path: str = Field("ORBIT_NOTES.md", min_length=1, max_length=300)
    consent_external: bool = False


class AgentStep(BaseModel):
    name: Literal["read", "analyze", "draft", "propose", "remember"]
    status: Literal["done", "skipped"]
    detail: str


class AgentRunOut(BaseModel):
    conversation_id: int
    steps: list[AgentStep]
    output: dict[str, Any]
    markdown: str
    change: ChangeOut
    memory: MemoryOut | None
    provider: ProviderInfo
    context: ContextUsed
    warnings: list[str] = []


class AgentLoopIn(BaseModel):
    goal: str = Field(min_length=3, max_length=2000)
    max_steps: int = Field(8, ge=1, le=12)
    consent_external: bool = False


class DraftIn(BaseModel):
    path: str = Field(min_length=1, max_length=500)
    instruction: str = Field(min_length=3, max_length=2000)
    consent_external: bool = False


class DraftOut(BaseModel):
    change: ChangeOut
    summary: str
    provider: ProviderInfo
    context: ContextUsed
    warnings: list[str] = []


class ComponentExplainIn(BaseModel):
    scene: str = Field(min_length=1, max_length=120)
    component: str = Field(min_length=1, max_length=120)
    summary: str = Field("", max_length=600)
    details: str = Field("", max_length=3000)


class ComponentExplainOut(BaseModel):
    explanation: str
    analogy: str
    failure_impact: str
    ai_generated: bool
    provider: ProviderInfo | None
    warnings: list[str] = []
