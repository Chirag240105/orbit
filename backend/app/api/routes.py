import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.orchestrator import enabled_names, run_chat
from app.api.deps import get_workspace, tool_ctx
from app.audit.log import audit
from app.auth import get_current_user
from app.core.errors import AppError
from app.core.ratelimit import RateLimiter
from app.db.session import get_db
from app.memory.service import store_user_memory
from app.models import (
    Conversation,
    Memory,
    Message,
    PendingAction,
    ProposedChange,
    SkillSetting,
    Task,
    ToolPermission,
    Workspace,
)
from app.schemas import (
    ChangeOut,
    ChatRequest,
    ChatResponse,
    ConversationOut,
    MemoryIn,
    MemoryOut,
    MemoryPatch,
    MessageOut,
    ProposeChangeIn,
    SkillOut,
    SkillPatch,
    TaskIn,
    TaskOut,
    TaskPatch,
    ToolPermissionPatch,
    WorkspaceIn,
    WorkspaceOut,
    WorkspacePatch,
)
from app.skills.base import SkillInput
from app.tools.agent_registry import (
    AGENT_TOOLS,
    decide_pending_action,
    invoke_agent_tool,
    tool_catalog,
)
from app.tools.registry import TOOLS, execute_tool
from app.workspace import service as wsvc
from app.workspace.policy import validate_workspace_root

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])
chat_limit = RateLimiter(limit=30, window_s=60)
VERSION = "0.1.0"


# ---------- health & settings ----------
@router.get("/health")
async def health(request: Request, db: Session = Depends(get_db)):
    p, s = request.app.state.provider, request.app.state.settings
    db.execute(select(1))
    gateway = request.app.state.model_gateway
    reachability = await gateway.check_reachability() if gateway else {
        "reachable": bool(p.is_demo), "checked_at": None,
        "reason": "demo mode" if p.is_demo else "provider is not configured",
    }
    return {
        "status": "ok", "version": VERSION, "database": "ok",
        "provider": {"name": p.name, "model": p.model, "configured": p.configured, "is_demo": p.is_demo,
                     "demo_mode": s.demo_mode or s.mock_ai, "endpoint": (s.nebius_base_url if s.llm_provider == "nebius" else s.nvidia_base_url) if s.llm_provider != "demo" else None,
                     "reachability": reachability},
    }


@router.get("/settings")
def settings_info(request: Request):
    s, p = request.app.state.settings, request.app.state.provider
    return {
        "provider": {"name": p.name, "model": p.model, "configured": p.configured, "is_demo": p.is_demo, "hosted": p.name in ("nebius", "nvidia"),
                     "endpoint": (s.nebius_base_url if s.llm_provider == "nebius" else s.nvidia_base_url) if s.llm_provider != "demo" else None},
        "limits": {"max_file_bytes": s.max_file_bytes, "max_context_chars": s.max_context_chars},
        "tools": (
            [{"name": t.name, "description": t.description, "permissions": list(t.permissions), "requires_confirmation": t.requires_confirmation} for t in TOOLS.values()]
            + [{"name": t.name, "description": t.description, "permissions": [t.permission], "requires_confirmation": t.permission == "write"} for t in AGENT_TOOLS.values()]
        ),
        "privacy": [
            "Chat messages and matched memories are sent to the hosted model provider when a provider is configured.",
            "Workspace file excerpts are sent only for files you select, after secret redaction, and only after you confirm.",
            "File indexing, search, and permissions run on this computer.",
            "Camera video stays in your browser. It is not recorded or uploaded.",
            "Demo mode sends nothing anywhere and does not use a model.",
        ],
    }


# ---------- chat ----------
@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(chat_limit)])
async def chat(req: ChatRequest, request: Request, db: Session = Depends(get_db)):
    st = request.app.state
    return await run_chat(req, db, st.settings, st.provider, st.registry, st.model_gateway, st.last_turns)


@router.get("/tools")
def list_agent_tools():
    return tool_catalog()


@router.get("/tool-permissions")
def list_tool_permissions(db: Session = Depends(get_db)):
    rows = {row.tool_name: row for row in db.scalars(select(ToolPermission))}
    return [
        {"tool_name": name, "permission": tool.permission,
         "trusted_for_session": bool(rows.get(name) and rows[name].trusted_for_session)}
        for name, tool in AGENT_TOOLS.items() if tool.permission == "write"
    ]


@router.patch("/tool-permissions/{name}")
def set_tool_permission(name: str, body: ToolPermissionPatch, db: Session = Depends(get_db)):
    tool = AGENT_TOOLS.get(name)
    if tool is None or tool.permission != "write":
        raise AppError("not_found", "Writable tool not found.", 404)
    row = db.scalar(select(ToolPermission).where(ToolPermission.tool_name == name))
    if row is None:
        row = ToolPermission(tool_name=name, permission=tool.permission)
    row.trusted_for_session = body.trusted_for_session
    db.add(row)
    db.commit()
    return {"tool_name": name, "permission": row.permission, "trusted_for_session": row.trusted_for_session}


@router.post("/tools/{name}/invoke")
async def invoke_tool(name: str, body: dict, request: Request, db: Session = Depends(get_db)):
    return await invoke_agent_tool(name, body, db, request.app.state.settings, request.app.state.model_gateway)


@router.get("/actions")
def list_pending_actions(status: str = "pending", db: Session = Depends(get_db)):
    return db.scalars(select(PendingAction).where(PendingAction.status == status).order_by(PendingAction.created_at.desc()).limit(100)).all()


@router.post("/actions/{action_id}/approve")
async def approve_pending_action(action_id: int, request: Request, db: Session = Depends(get_db)):
    action = await decide_pending_action(action_id, approve=True, db=db, settings=request.app.state.settings, gateway=request.app.state.model_gateway)
    return {"id": action.id, "tool_name": action.tool_name, "arguments": action.arguments, "status": action.status, "created_at": action.created_at, "decided_at": action.decided_at}


@router.post("/actions/{action_id}/reject")
async def reject_pending_action(action_id: int, request: Request, db: Session = Depends(get_db)):
    action = await decide_pending_action(action_id, approve=False, db=db, settings=request.app.state.settings, gateway=request.app.state.model_gateway)
    return {"id": action.id, "tool_name": action.tool_name, "arguments": action.arguments, "status": action.status, "created_at": action.created_at, "decided_at": action.decided_at}


@router.get("/debug/last-turns")
def last_turns(request: Request):
    return list(request.app.state.last_turns)


@router.get("/conversations", response_model=list[ConversationOut])
def conversations(db: Session = Depends(get_db)):
    return db.scalars(select(Conversation).order_by(Conversation.updated_at.desc()).limit(50)).all()


@router.get("/conversations/{cid}/messages", response_model=list[MessageOut])
def messages(cid: int, db: Session = Depends(get_db)):
    if db.get(Conversation, cid) is None:
        raise AppError("not_found", "Conversation not found.", 404)
    rows = db.scalars(select(Message).where(Message.conversation_id == cid).order_by(Message.id)).all()
    return [MessageOut(id=m.id, role=m.role, content=json.loads(m.content) if m.role == "assistant" else m.content, skill=m.skill, meta=m.meta, created_at=m.created_at) for m in rows]


@router.delete("/conversations/{cid}", status_code=204)
def delete_conversation(cid: int, db: Session = Depends(get_db)):
    c = db.get(Conversation, cid)
    if c is None:
        raise AppError("not_found", "Conversation not found.", 404)
    db.query(Message).filter(Message.conversation_id == cid).delete()
    db.delete(c)
    db.commit()


@router.delete("/conversations", status_code=204)
def delete_all_conversations(db: Session = Depends(get_db)):
    db.query(Message).delete()
    db.query(Conversation).delete()
    db.commit()
    audit(db, "history.delete_all")


# ---------- memory ----------
@router.get("/memories", response_model=list[MemoryOut])
def list_memories(q: str = "", db: Session = Depends(get_db)):
    stmt = select(Memory).order_by(Memory.updated_at.desc())
    if q.strip():
        stmt = stmt.where(Memory.content.ilike(f"%{q.strip()}%"))
    return db.scalars(stmt).all()


@router.post("/memories", response_model=MemoryOut, status_code=201)
async def create_memory(body: MemoryIn, request: Request, db: Session = Depends(get_db)):
    return await store_user_memory(db, body.content, body.type, request.app.state.model_gateway, body.source)


@router.patch("/memories/{mid}", response_model=MemoryOut)
def patch_memory(mid: int, body: MemoryPatch, db: Session = Depends(get_db)):
    m = db.get(Memory, mid)
    if m is None:
        raise AppError("not_found", "Memory not found.", 404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit()
    return m


@router.delete("/memories/{mid}", status_code=204)
def delete_memory(mid: int, db: Session = Depends(get_db)):
    m = db.get(Memory, mid)
    if m is None:
        raise AppError("not_found", "Memory not found.", 404)
    db.delete(m)
    db.commit()


@router.delete("/memories", status_code=204)
def delete_all_memories(db: Session = Depends(get_db)):
    db.query(Memory).delete()
    db.commit()
    audit(db, "memory.delete_all")


# ---------- skills ----------
@router.get("/skills", response_model=list[SkillOut])
def skills(request: Request, db: Session = Depends(get_db)):
    reg = request.app.state.registry
    on = enabled_names(db, reg)
    return [
        SkillOut(name=s.name, title=s.title, description=s.description, required_permissions=list(s.required_permissions), requires_files=s.requires_files, enabled=s.name in on, input_schema=SkillInput.model_json_schema(), output_schema=s.output_model.model_json_schema())
        for s in reg.all()
    ]


@router.patch("/skills/{name}")
def toggle_skill(name: str, body: SkillPatch, request: Request, db: Session = Depends(get_db)):
    if request.app.state.registry.get(name) is None:
        raise AppError("not_found", "Skill not found.", 404)
    row = db.scalar(select(SkillSetting).where(SkillSetting.name == name)) or SkillSetting(name=name)
    row.enabled = body.enabled
    db.add(row)
    db.commit()
    return {"name": name, "enabled": row.enabled}


# ---------- workspaces ----------
@router.get("/workspaces", response_model=list[WorkspaceOut])
def list_workspaces(db: Session = Depends(get_db)):
    return db.scalars(select(Workspace).order_by(Workspace.id)).all()


@router.post("/workspaces", response_model=WorkspaceOut, status_code=201)
def add_workspace(body: WorkspaceIn, db: Session = Depends(get_db)):
    root = validate_workspace_root(body.path)
    if db.scalar(select(Workspace).where(Workspace.path == str(root))):
        raise AppError("duplicate", "This folder is already authorized.", 409)
    ws = Workspace(name=(body.name or root.name)[:80], path=str(root))
    db.add(ws)
    db.commit()
    audit(db, "workspace.add", name=ws.name)
    return ws


@router.patch("/workspaces/{workspace_id}", response_model=WorkspaceOut)
def patch_workspace(body: WorkspacePatch, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    ws.allow_write = body.allow_write
    db.commit()
    audit(db, "workspace.write_enabled" if ws.allow_write else "workspace.write_disabled", workspace_id=ws.id)
    return ws


@router.delete("/workspaces/{workspace_id}", status_code=204)
def remove_workspace(ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    db.query(ProposedChange).filter(ProposedChange.workspace_id == ws.id).delete()
    db.delete(ws)
    db.commit()
    audit(db, "workspace.remove", name=ws.name)


@router.get("/workspaces/{workspace_id}/tree")
def tree(request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    return execute_tool("list_files", {}, tool_ctx(request, db, ws))


@router.get("/workspaces/{workspace_id}/summary")
def summary(ws: Workspace = Depends(get_workspace)):
    return wsvc.summarize(ws.path)


@router.get("/workspaces/{workspace_id}/search")
def search(q: str, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    return execute_tool("search_files", {"query": q}, tool_ctx(request, db, ws))


@router.get("/workspaces/{workspace_id}/file")
def read_file(path: str, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    return execute_tool("read_file", {"path": path}, tool_ctx(request, db, ws))


@router.post("/workspaces/{workspace_id}/changes", response_model=ChangeOut, status_code=201)
def propose(body: ProposeChangeIn, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    return execute_tool("propose_change", body.model_dump(), tool_ctx(request, db, ws))


# ---------- changes (approval flow) ----------
@router.get("/changes", response_model=list[ChangeOut])
def list_changes(status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(ProposedChange).order_by(ProposedChange.id.desc()).limit(100)
    if status:
        stmt = stmt.where(ProposedChange.status == status)
    return db.scalars(stmt).all()


def _change(db: Session, cid: int) -> ProposedChange:
    c = db.get(ProposedChange, cid)
    if c is None:
        raise AppError("not_found", "Change not found.", 404)
    return c


@router.post("/changes/{cid}/approve", response_model=ChangeOut)
def approve(cid: int, request: Request, db: Session = Depends(get_db)):
    c = _change(db, cid)
    ws = db.get(Workspace, c.workspace_id)
    execute_tool("apply_change", {"change_id": cid}, tool_ctx(request, db, ws, confirmed=True))
    db.refresh(c)
    return c


@router.post("/changes/{cid}/reject", response_model=ChangeOut)
def reject(cid: int, db: Session = Depends(get_db)):
    c = _change(db, cid)
    if c.status != "pending":
        raise AppError("invalid_state", "Only pending changes can be rejected.", 409)
    c.status, c.decided_at = "rejected", datetime.now(timezone.utc)
    db.commit()
    audit(db, "change.reject", change_id=c.id)
    return c


# ---------- tasks ----------
@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    return db.scalars(select(Task).order_by(Task.id.desc())).all()


@router.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(body: TaskIn, db: Session = Depends(get_db)):
    t = Task(**body.model_dump())
    db.add(t)
    db.commit()
    return t


@router.patch("/tasks/{tid}", response_model=TaskOut)
def patch_task(tid: int, body: TaskPatch, db: Session = Depends(get_db)):
    t = db.get(Task, tid)
    if t is None:
        raise AppError("not_found", "Task not found.", 404)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit()
    return t


@router.delete("/tasks/{tid}", status_code=204)
def delete_task(tid: int, db: Session = Depends(get_db)):
    t = db.get(Task, tid)
    if t is None:
        raise AppError("not_found", "Task not found.", 404)
    db.delete(t)
    db.commit()
