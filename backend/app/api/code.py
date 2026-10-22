from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_workspace, tool_ctx
from app.audit.log import audit
from app.auth import get_current_user
from app.core.errors import AppError
from app.db.session import get_db
from app.models import ProposedChange, Workspace
from app.schemas import ChangeOut, ProposeChangeIn, WorkspaceIn, WorkspaceOut, WorkspacePatch
from app.tools.registry import execute_tool
from app.workspace import service as wsvc
from app.workspace.code_explain import CodeExplainIn, explain_code
from app.workspace.policy import validate_workspace_root

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])


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

@router.post("/code/explain")
async def code_explanation(body: CodeExplainIn, request: Request, db: Session = Depends(get_db)):
    return await explain_code(body, db, request.app.state.settings, request.app.state.model_gateway)

@router.get("/workspaces/{workspace_id}/search")
def search(q: str, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    return execute_tool("search_files", {"query": q}, tool_ctx(request, db, ws))

@router.get("/workspaces/{workspace_id}/file")
def read_file(path: str, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    return execute_tool("read_file", {"path": path}, tool_ctx(request, db, ws))

@router.post("/workspaces/{workspace_id}/changes", response_model=ChangeOut, status_code=201)
def propose(body: ProposeChangeIn, request: Request, ws: Workspace = Depends(get_workspace), db: Session = Depends(get_db)):
    return execute_tool("propose_change", body.model_dump(), tool_ctx(request, db, ws))
