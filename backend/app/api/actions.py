from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import tool_ctx
from app.audit.log import audit
from app.auth import get_current_user
from app.core.errors import AppError
from app.db.session import get_db
from app.models import PendingAction, ProposedChange, Workspace
from app.schemas import ChangeOut
from app.tools.agent_registry import decide_pending_action
from app.tools.registry import execute_tool

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])


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
