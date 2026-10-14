from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.session import get_db
from app.models import Workspace
from app.tools.registry import ToolContext


def get_workspace(workspace_id: int, db: Session = Depends(get_db)) -> Workspace:
    ws = db.get(Workspace, workspace_id)
    if ws is None:
        raise AppError("not_found", "Workspace not found.", 404)
    return ws


def tool_ctx(request: Request, db: Session, ws: Workspace, *, confirmed: bool = False) -> ToolContext:
    granted = {"workspace.read", "workspace.propose"}
    if ws.allow_write:
        granted.add("workspace.write")
    return ToolContext(db=db, settings=request.app.state.settings, workspace=ws, granted=granted, confirmed=confirmed)
