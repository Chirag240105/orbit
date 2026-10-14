import hmac

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.session import get_db
from app.models import Workspace
from app.tools.registry import ToolContext


def require_token(request: Request) -> None:
    """SEC-01: every API call needs the per-install token. The dev proxy adds it; browsers never see it.
    Read from the raw header (not a declared parameter) so it stays out of the public OpenAPI contract."""
    supplied = request.headers.get("x-orbit-token", "")
    if not hmac.compare_digest(supplied.encode(), request.app.state.api_token.encode()):
        raise AppError("unauthorized", "Missing or invalid local API token. Open ORBIT through its own dev server (npm run dev).", 401)


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
