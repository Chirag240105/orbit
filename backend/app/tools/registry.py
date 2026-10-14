"""Allowlisted tools. The model never calls these directly in the MVP; API routes do, after user action.
Every call: schema validation -> permission check -> confirmation check -> audit -> handler."""
from collections.abc import Callable
from dataclasses import dataclass, field

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.audit.log import audit
from app.config import Settings
from app.core.errors import AppError
from app.models import ProposedChange, Workspace
from app.workspace import service as ws
from app.workspace.policy import resolve_inside


@dataclass
class ToolContext:
    db: Session
    settings: Settings
    workspace: Workspace
    granted: set[str] = field(default_factory=set)
    confirmed: bool = False  # True only from an explicit user approval route


class ListFilesIn(BaseModel):
    pass


class SearchIn(BaseModel):
    query: str = Field(min_length=1, max_length=100)


class SuggestIn(BaseModel):
    query: str = Field(min_length=1, max_length=500)


class ReadIn(BaseModel):
    path: str = Field(min_length=1, max_length=500)


class ProposeIn(BaseModel):
    path: str = Field(min_length=1, max_length=500)
    new_content: str = Field(max_length=500_000)
    description: str = Field("", max_length=300)


class ApplyIn(BaseModel):
    change_id: int


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    permissions: tuple[str, ...]
    requires_confirmation: bool
    input_model: type[BaseModel]
    handler: Callable


def _list(ctx: ToolContext, a: ListFilesIn):
    return ws.list_files(ctx.workspace.path)


def _search(ctx: ToolContext, a: SearchIn):
    return ws.search(ctx.workspace.path, a.query, ctx.settings.max_file_bytes)


def _suggest(ctx: ToolContext, a: SuggestIn):
    return ws.rank_files(ctx.workspace.path, a.query, ctx.settings.max_file_bytes)


def _read(ctx: ToolContext, a: ReadIn):
    return {"path": a.path, "content": ws.read_text(ctx.workspace.path, a.path, ctx.settings.max_file_bytes)}


def _propose(ctx: ToolContext, a: ProposeIn):
    target = resolve_inside(ctx.workspace.path, a.path, must_exist=False)
    original = base_hash = None
    if target.exists():
        original = ws.read_text(ctx.workspace.path, a.path, ctx.settings.max_file_bytes)
        base_hash = ws.file_hash(target)
    change = ProposedChange(workspace_id=ctx.workspace.id, rel_path=a.path, description=a.description, original_content=original, base_hash=base_hash, new_content=a.new_content)
    ctx.db.add(change)
    ctx.db.commit()
    return change


def _apply(ctx: ToolContext, a: ApplyIn):
    from datetime import datetime, timezone

    change = ctx.db.get(ProposedChange, a.change_id)
    if not change or change.workspace_id != ctx.workspace.id or change.status != "pending":
        raise AppError("not_found", "No pending change with that id.", 404)
    target = resolve_inside(ctx.workspace.path, change.rel_path, must_exist=False)
    current = ws.file_hash(target) if target.exists() else None
    if current != change.base_hash:
        change.status, change.decided_at = "stale", datetime.now(timezone.utc)
        ctx.db.commit()
        raise AppError("stale_change", "The file changed after this proposal was made. Propose the change again.", 409)
    ws.apply_write(ctx.workspace.path, change.rel_path, change.new_content, ctx.settings.max_file_bytes)  # verifies the written hash
    change.status, change.decided_at = "applied", datetime.now(timezone.utc)
    ctx.db.commit()
    return change


TOOLS: dict[str, ToolSpec] = {
    t.name: t
    for t in (
        ToolSpec("list_files", "List permitted files in the workspace", ("workspace.read",), False, ListFilesIn, _list),
        ToolSpec("search_files", "Search permitted files by name and content", ("workspace.read",), False, SearchIn, _search),
        ToolSpec("suggest_files", "Rank permitted files by relevance to a question (local, nothing is sent)", ("workspace.read",), False, SuggestIn, _suggest),
        ToolSpec("read_file", "Read one permitted text file", ("workspace.read",), False, ReadIn, _read),
        ToolSpec("propose_change", "Create a proposal to change a file (does not write)", ("workspace.propose",), False, ProposeIn, _propose),
        ToolSpec("apply_change", "Write an approved proposal to disk", ("workspace.write",), True, ApplyIn, _apply),
    )
}


def execute_tool(name: str, raw_args: dict, ctx: ToolContext):
    spec = TOOLS.get(name)
    if spec is None:
        raise AppError("unknown_tool", "Unknown tool.", 404)
    try:
        args = spec.input_model(**raw_args)
    except ValidationError:
        raise AppError("invalid_tool_input", "Invalid tool input.", 422) from None
    missing = set(spec.permissions) - ctx.granted
    if missing:
        raise AppError(
            "permission_denied",
            "Write access is disabled for this workspace. Turn it on in Projects, then approve again."
            if "workspace.write" in missing else "This action is not permitted.",
            403,
        )
    if spec.requires_confirmation and not ctx.confirmed:
        raise AppError("confirmation_required", "This action needs explicit user confirmation.", 409)
    audit(ctx.db, f"tool.{name}", workspace_id=ctx.workspace.id, path=getattr(args, "path", None))
    return spec.handler(ctx, args)
