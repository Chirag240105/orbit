import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent import loop, workflows
from app.agent.orchestrator import enabled_names, prepare_chat, run_chat, sse, stream_chat
from app.api.deps import get_workspace, require_token, tool_ctx
from app.audit.log import audit
from app.core.errors import AppError
from app.db.session import get_db
from app.models import Conversation, Memory, Message, ProposedChange, SkillSetting, Task, Workspace
from app.schemas import (
    AgentLoopIn,
    AgentRunOut,
    ChangeOut,
    ChatRequest,
    ChatResponse,
    ComponentExplainIn,
    ComponentExplainOut,
    ConversationOut,
    DraftIn,
    DraftOut,
    FileContent,
    FileEntry,
    FileSuggestion,
    HealthOut,
    MemoryIn,
    MemoryOut,
    MemoryPatch,
    MessageOut,
    ProjectNotesIn,
    ProposeChangeIn,
    SearchHit,
    SettingsOut,
    SkillOut,
    SkillPatch,
    SkillToggleOut,
    TaskIn,
    TaskOut,
    TaskPatch,
    WorkspaceIn,
    WorkspaceOut,
    WorkspacePatch,
    WorkspaceSummary,
)
from app.skills.base import SkillInput
from app.tools.registry import TOOLS, execute_tool
from app.workspace import service as wsvc
from app.workspace.policy import validate_workspace_root

public = APIRouter(prefix="/api")  # no token: liveness only
router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


def chat_limit(request: Request) -> None:
    """Per-app limiter for endpoints that call the model (so separate app instances never share a budget)."""
    request.app.state.chat_limiter(request)

VERSION = "0.1.0"


# ---------- health & settings ----------
@public.get("/health", response_model=HealthOut)
def health(request: Request, db: Session = Depends(get_db)):
    p, s = request.app.state.provider, request.app.state.settings
    db.execute(select(1))
    return {
        "status": "ok", "version": VERSION, "database": "ok",
        "provider": {"name": p.name, "model": p.model, "configured": p.configured, "is_demo": p.is_demo, "demo_mode": s.demo_mode},
    }


@router.get("/settings", response_model=SettingsOut)
def settings_info(request: Request):
    s, p = request.app.state.settings, request.app.state.provider
    return {
        "provider": {"name": p.name, "model": p.model, "configured": p.configured, "is_demo": p.is_demo, "hosted": p.name == "nebius"},
        "limits": {"max_file_bytes": s.max_file_bytes, "max_context_chars": s.max_context_chars},
        "model_routing": s.model_routing,
        "tools": [{"name": t.name, "description": t.description, "permissions": list(t.permissions), "requires_confirmation": t.requires_confirmation} for t in TOOLS.values()],
        "privacy": [
            "Chat messages and matched memories are sent to the hosted model provider when a provider is configured.",
            "Workspace file excerpts, and the project layout (file and dependency names), are sent only after secret redaction and only after you confirm.",
            "Earlier messages of the current conversation are included so follow-up questions make sense.",
            "File indexing, search, and permissions run on this computer.",
            "Camera video stays in your browser. It is not recorded or uploaded.",
            "Demo mode sends nothing anywhere and does not use a model.",
        ],
    }


# ---------- chat ----------
@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(chat_limit)])
async def chat(req: ChatRequest, request: Request, db: Session = Depends(get_db)):
    st = request.app.state
    return await run_chat(req, db, st.settings, st.provider, st.registry)


@router.post(
    "/chat/stream", dependencies=[Depends(chat_limit)], response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}, "description": "Events: status, token, then done (a ChatResponse) or error."}},
)
async def chat_stream(req: ChatRequest, request: Request, db: Session = Depends(get_db)):
    """Same as /chat, streamed. Errors found before the model is called (consent, permissions) are normal JSON errors."""
    st = request.app.state
    plan = await prepare_chat(req, db, st.settings, st.provider, st.registry)
    if isinstance(plan, ChatResponse):
        async def single():
            yield sse("done", plan.model_dump(mode="json"))
        return StreamingResponse(single(), media_type="text/event-stream")
    return StreamingResponse(stream_chat(plan, req.message, st.settings, st.provider), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


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
def create_memory(body: MemoryIn, db: Session = Depends(get_db)):
    m = Memory(content=body.content, type=body.type, source=body.source, confirmed=body.source == "user")
    db.add(m)
    db.commit()
    return m


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
        SkillOut(name=s.name, title=s.title, description=s.description, required_permissions=list(s.required_permissions), requires_files=s.requires_files,
                 uses_workspace_summary=s.uses_workspace_summary, invocation=s.invocation, enabled=s.name in on,
                 input_schema=SkillInput.model_json_schema(), output_schema=s.output_model.model_json_schema())
        for s in reg.all()
    ]


@router.patch("/skills/{name}", response_model=SkillToggleOut)
def toggle_skill(name: str, body: SkillPatch, request: Request, db: Session = Depends(get_db)):
    if request.app.state.registry.get(name) is None:
        raise AppError("not_found", "Skill not found.", 404)
    row = db.get(SkillSetting, name) or SkillSetting(name=name)
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


@router.get("/workspaces/{workspace_id}/tree", response_model=list[FileEntry])
def tree(request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    return execute_tool("list_files", {}, tool_ctx(request, db, ws))


@router.get("/workspaces/{workspace_id}/summary", response_model=WorkspaceSummary)
def summary(request: Request, ws: Workspace = Depends(get_workspace)):
    return wsvc.summarize(ws.path, request.app.state.settings.max_file_bytes)


@router.get("/workspaces/{workspace_id}/search", response_model=list[SearchHit])
def search(q: str, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    return execute_tool("search_files", {"query": q}, tool_ctx(request, db, ws))


@router.get("/workspaces/{workspace_id}/suggest", response_model=list[FileSuggestion])
def suggest(q: str, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    """BE-03: rank files for a question locally. The user picks which ones (if any) to send."""
    return execute_tool("suggest_files", {"query": q}, tool_ctx(request, db, ws))


@router.get("/workspaces/{workspace_id}/file", response_model=FileContent)
def read_file(path: str, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    return execute_tool("read_file", {"path": path}, tool_ctx(request, db, ws))


@router.post("/workspaces/{workspace_id}/changes", response_model=ChangeOut, status_code=201)
def propose(body: ProposeChangeIn, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    return execute_tool("propose_change", body.model_dump(), tool_ctx(request, db, ws))


@router.post("/workspaces/{workspace_id}/draft", response_model=DraftOut, status_code=201, dependencies=[Depends(chat_limit)])
async def draft(body: DraftIn, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    """AI-08: the model drafts new content; it only becomes a proposal."""
    st = request.app.state
    return await workflows.run_draft(ws, body, db, st.settings, st.provider, st.registry)


# ---------- agent ----------
@router.post("/workspaces/{workspace_id}/agent/notes", response_model=AgentRunOut, status_code=201, dependencies=[Depends(chat_limit)])
async def project_notes(body: ProjectNotesIn, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    """Read authorized files -> analyze -> draft a notes file -> propose it -> suggest a project memory."""
    st = request.app.state
    return await workflows.run_project_notes(ws, body, db, st.settings, st.provider, st.registry)


@router.post(
    "/workspaces/{workspace_id}/agent/loop", dependencies=[Depends(chat_limit)], response_class=StreamingResponse,
    responses={200: {"content": {"text/event-stream": {}}, "description": "Events: step (one per tool call), then done or error."}},
)
async def agent_loop(body: AgentLoopIn, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    """AG-02 agent mode (opt-in): the model chooses read-only tools and may propose changes; it can never write."""
    st = request.app.state
    plan = await loop.prepare_loop(ws, body, db, st.settings, st.provider, st.registry)
    return StreamingResponse(loop.run_loop(plan, st.settings, st.provider), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/learn/explain", response_model=ComponentExplainOut, dependencies=[Depends(chat_limit)])
async def explain_component(body: ComponentExplainIn, request: Request, db: Session = Depends(get_db)):
    st = request.app.state
    return await workflows.explain_component(body, db, st.settings, st.provider, st.registry)


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
