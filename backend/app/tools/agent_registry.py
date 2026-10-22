"""Permission-aware tools for the agent loop.

Reads run immediately and are audited. Writes become user-owned pending actions
and are executed only after explicit approval (unless trusted for this session).
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import date as Date
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.log import audit
from app.config import Settings
from app.core.errors import AppError
from app.memory.service import retrieve_relevant, store_user_memory
from app.models import Memory, Note, PendingAction, Project, Task, ToolPermission, Workspace
from app.security.redaction import redact
from app.services.model_gateway import ModelGateway
from app.workspace.service import read_text

Permission = Literal["read", "write", "execute"]
Handler = Callable[[Session, dict, Settings, ModelGateway | None], Awaitable[object]]


class CreateTaskArgs(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str = Field("", max_length=4000)
    priority: Literal["high", "medium", "low"] = "medium"
    due: Date | None = None


class ListTasksArgs(BaseModel):
    pass


class UpdateTaskArgs(BaseModel):
    task_id: int
    title: str | None = Field(None, min_length=1, max_length=200)
    notes: str | None = Field(None, max_length=4000)
    status: Literal["todo", "doing", "done"] | None = None
    priority: Literal["high", "medium", "low"] | None = None
    due: Date | None = None


class CreateNoteArgs(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field("", max_length=20_000)
    project_id: int | None = None


class SaveMemoryArgs(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    type: str = "USER"


class SearchMemoryArgs(BaseModel):
    query: str = Field(min_length=1, max_length=2000)


class GenerateScheduleArgs(BaseModel):
    request: str = Field(min_length=1, max_length=8000)
    date: Date | None = None


class AnalyzeCodeArgs(BaseModel):
    workspace_id: int
    path: str = Field(min_length=1, max_length=500)


class SaveVisionContextArgs(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    project_id: int | None = None


@dataclass(frozen=True)
class AgentTool:
    name: str
    description: str
    permission: Permission
    parameters: type[BaseModel]
    handler: Handler


async def _create_task(db: Session, args: dict, _settings: Settings, _gateway: ModelGateway | None):
    task = Task(title=args["title"], notes=args["notes"], priority=args["priority"], due=args["due"], status="todo", source="user")
    db.add(task)
    return task


async def _list_tasks(db: Session, _args: dict, _settings: Settings, _gateway: ModelGateway | None):
    return [
        {"id": t.id, "title": t.title, "status": t.status, "priority": t.priority, "due": t.due.isoformat() if t.due else None}
        for t in db.scalars(select(Task).order_by(Task.due, Task.id))
    ]


async def _update_task(db: Session, args: dict, _settings: Settings, _gateway: ModelGateway | None):
    task = db.get(Task, args.pop("task_id"))
    if task is None:
        raise AppError("not_found", "Task not found.", 404)
    for key, value in args.items():
        if value is not None:
            setattr(task, key, value)
    return task


async def _create_note(db: Session, args: dict, _settings: Settings, _gateway: ModelGateway | None):
    project_id = args.get("project_id")
    if project_id is not None and db.scalar(select(Project.id).where(Project.id == project_id)) is None:
        raise AppError("not_found", "Project not found.", 404)
    note = Note(**args)
    db.add(note)
    return note


async def _save_memory(db: Session, args: dict, _settings: Settings, gateway: ModelGateway | None):
    if args["type"] not in {"USER", "PROJECT", "TASK", "PREFERENCE", "DECISION", "EVENT", "CODE_CONTEXT", "VISION"}:
        raise AppError("invalid_tool_input", "Memory type is not supported.", 422)
    return await store_user_memory(db, args["content"], args["type"], gateway)


async def _search_memory(db: Session, args: dict, _settings: Settings, gateway: ModelGateway | None):
    memories = await retrieve_relevant(db, args["query"], gateway)
    return [{"id": m.id, "type": m.type, "content": m.content} for m in memories]


async def _generate_schedule(_db: Session, _args: dict, _settings: Settings, _gateway: ModelGateway | None):
    if _gateway is None:
        raise AppError("model_not_configured", "Schedule generation needs the model gateway.", 503)
    from app.schedule.service import ScheduleGenerateIn, create_schedule_draft

    day = _args.get("date") or Date.today()
    draft, action_id = await create_schedule_draft(
        ScheduleGenerateIn(request=_args["request"], date=day), _db, _settings, _gateway,
    )
    return {
        "pending_action_id": action_id,
        "status": "pending",
        "tool_name": "schedule_approval",
        "draft": draft.model_dump(mode="json"),
    }


async def _analyze_code(db: Session, args: dict, settings: Settings, gateway: ModelGateway | None):
    workspace = db.get(Workspace, args["workspace_id"])
    if workspace is None:
        raise AppError("not_found", "Workspace not found.", 404)
    content = read_text(workspace.path, args["path"], settings.max_file_bytes)
    content, _ = redact(content)
    if gateway and gateway.provider != "demo" and not settings.demo_mode and not settings.mock_ai and not args.get("_consent_external", False):
        raise AppError("consent_required", "Confirm before sending selected code to the hosted model.", 409)
    return {"path": args["path"], "content": content[:settings.max_context_chars]}


async def _save_vision_context(db: Session, args: dict, _settings: Settings, gateway: ModelGateway | None):
    project_id = args.get("project_id")
    if project_id is not None and db.scalar(select(Project.id).where(Project.id == project_id)) is None:
        raise AppError("not_found", "Project not found.", 404)
    memory = await store_user_memory(db, args["content"], "VISION", gateway)
    if project_id is not None:
        memory.project_id = project_id
    return memory


AGENT_TOOLS: dict[str, AgentTool] = {
    tool.name: tool
    for tool in (
        AgentTool("create_task", "Create a task", "write", CreateTaskArgs, _create_task),
        AgentTool("list_tasks", "List the user's tasks", "read", ListTasksArgs, _list_tasks),
        AgentTool("update_task", "Update a task", "write", UpdateTaskArgs, _update_task),
        AgentTool("create_note", "Create a project note", "write", CreateNoteArgs, _create_note),
        AgentTool("save_memory", "Save a user-confirmed memory", "write", SaveMemoryArgs, _save_memory),
        AgentTool("search_memory", "Search confirmed memories", "read", SearchMemoryArgs, _search_memory),
        AgentTool("generate_schedule", "Prepare a schedule proposal for user approval", "read", GenerateScheduleArgs, _generate_schedule),
        AgentTool("analyze_code", "Read and analyze an authorized code file", "read", AnalyzeCodeArgs, _analyze_code),
        AgentTool("save_vision_context", "Save a vision observation as memory", "write", SaveVisionContextArgs, _save_vision_context),
    )
}


def _encode_result(value: object) -> object:
    if isinstance(value, (Task, Note, Memory)):
        return {"id": value.id, "title": getattr(value, "title", None), "content": getattr(value, "content", None)}
    if isinstance(value, list):
        return [_encode_result(item) for item in value]
    return value


async def invoke_agent_tool(
    name: str, raw_args: dict, db: Session, settings: Settings, gateway: ModelGateway | None = None,
    *, consent_external: bool = False,
) -> dict:
    tool = AGENT_TOOLS.get(name)
    if tool is None:
        raise AppError("unknown_tool", "Unknown agent tool.", 404)
    if tool.permission == "execute":
        raise AppError("not_implemented", "Execute permission is reserved for future work.", 501)
    try:
        validated = tool.parameters(**raw_args)
        args = validated.model_dump(mode="json") if tool.permission == "write" else validated.model_dump()
    except ValidationError:
        raise AppError("invalid_tool_input", "Invalid tool input.", 422) from None
    if name == "analyze_code":
        args["_consent_external"] = consent_external
    audit(db, f"agent_tool.{name}.request", permission=tool.permission)
    if tool.permission == "write":
        permission = db.scalar(select(ToolPermission).where(ToolPermission.tool_name == name))
        if permission is None or not permission.trusted_for_session:
            action = PendingAction(tool_name=name, arguments=args)
            db.add(action)
            db.commit()
            audit(db, f"agent_tool.{name}.pending", action_id=action.id)
            return {"pending_action_id": action.id, "status": "pending", "tool_name": name}
    result = await tool.handler(db, args, settings, gateway)
    db.commit()
    audit(db, f"agent_tool.{name}.executed", permission=tool.permission)
    encoded = _encode_result(result)
    if isinstance(encoded, dict) and encoded.get("status") == "pending":
        return encoded | {"tool_name": name}
    return {"status": "executed", "tool_name": name, "result": encoded}


async def decide_pending_action(
    action_id: int, *, approve: bool, db: Session, settings: Settings, gateway: ModelGateway | None = None
) -> PendingAction:
    action = db.get(PendingAction, action_id)
    if action is None or action.status != "pending":
        raise AppError("not_found", "Pending action not found.", 404)
    if not approve:
        action.status = "rejected"
        action.decided_at = datetime.now(timezone.utc)
        db.commit()
        audit(db, "agent_action.reject", action_id=action.id, tool_name=action.tool_name)
        return action
    if action.tool_name == "schedule_approval":
        from app.schedule.service import approve_schedule

        approve_schedule(db, action.arguments)
        action.status = "approved"
        action.decided_at = datetime.now(timezone.utc)
        db.commit()
        audit(db, "agent_action.approve", action_id=action.id, tool_name=action.tool_name)
        return action
    tool = AGENT_TOOLS.get(action.tool_name)
    if tool is None or tool.permission != "write":
        raise AppError("invalid_action", "This pending action cannot be executed.", 409)
    try:
        args = tool.parameters(**action.arguments).model_dump()
    except ValidationError:
        raise AppError("invalid_action", "The pending action is no longer valid.", 409) from None
    await tool.handler(db, args, settings, gateway)
    action.status = "approved"
    action.decided_at = datetime.now(timezone.utc)
    db.commit()
    audit(db, "agent_action.approve", action_id=action.id, tool_name=action.tool_name)
    return action


def tool_catalog() -> list[dict]:
    return [
        {"name": tool.name, "description": tool.description, "permission": tool.permission,
         "parameters": tool.parameters.model_json_schema()}
        for tool in AGENT_TOOLS.values()
    ]
