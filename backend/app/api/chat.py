import json

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.orchestrator import run_chat
from app.audit.log import audit
from app.auth import get_current_user
from app.core.errors import AppError
from app.core.ratelimit import RateLimiter
from app.db.session import get_db
from app.models import Conversation, Message, ToolPermission
from app.schemas import ChatRequest, ChatResponse, ConversationOut, MessageOut, ToolPermissionPatch
from app.tools.agent_registry import AGENT_TOOLS, invoke_agent_tool, tool_catalog

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])
chat_limit = RateLimiter(limit=30, window_s=60)


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

@router.get("/debug/last-turns")
def last_turns(request: Request, user=Depends(get_current_user)):
    return [{k: v for k, v in row.items() if k != "user_id"} for row in request.app.state.last_turns if row.get("user_id") == user.id]

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
