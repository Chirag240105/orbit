from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db.session import get_db
from app.tools.agent_registry import AGENT_TOOLS
from app.tools.registry import TOOLS

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])
VERSION = "0.1.0"


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
        "status": "ok",
        "version": VERSION,
        "database": "ok",
        "provider": {
            "name": p.name,
            "model": p.model,
            "model_planner": s.model_planner,
            "model_fast": s.model_fast,
            "model_embed": s.model_embed,
            "configured": p.configured,
            "is_demo": p.is_demo,
            "demo_mode": s.demo_mode or s.mock_ai,
            "endpoint": s.active_base_url,
            "reachability": reachability,
        },
    }


@router.get("/settings")
def settings_info(request: Request):
    s, p = request.app.state.settings, request.app.state.provider
    return {
        "provider": {
            "name": p.name,
            "model": p.model,
            "model_planner": s.model_planner,
            "model_fast": s.model_fast,
            "model_embed": s.model_embed,
            "configured": p.configured,
            "is_demo": p.is_demo,
            "hosted": p.name in ("nebius", "nvidia"),
            "endpoint": s.active_base_url,
        },
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
