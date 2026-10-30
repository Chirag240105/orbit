"""API endpoints for the repo-to-3D-scene pipeline."""
import logging
import os

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.audit.log import audit
from app.auth import get_current_user
from app.core.errors import AppError
from app.core.ratelimit import RateLimiter
from app.db.session import get_db
from app.models import Workspace
from app.schemas import SceneResponse
from app.services.repo_design import design_from_repo, parse_github_url

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])
log = logging.getLogger("orbit.api.repo_design")
repo_limit = RateLimiter(limit=5, window_s=3600)


class GithubDesignRequest(BaseModel):
    github_url: str = Field(min_length=10, max_length=300)


class WorkspaceDesignRequest(BaseModel):
    workspace_id: int


@router.post("/repo-design/github", response_model=SceneResponse, dependencies=[Depends(repo_limit)])
async def design_from_github(body: GithubDesignRequest, request: Request, db: Session = Depends(get_db)):
    """Generate a 3D scene from a public GitHub repository URL."""
    provider = request.app.state.provider
    if provider.is_demo or not provider.configured:
        raise AppError(
            "scene_generation_unavailable",
            "Connect a model provider (NVIDIA_API_KEY) to generate repo scenes.",
            503,
        )

    # Validate the URL early so we don't attempt a fetch on bad input
    parse_github_url(body.github_url)

    github_token = os.environ.get("GITHUB_TOKEN")
    gateway = request.app.state.model_gateway

    async def progress(stage: str, message: str) -> None:
        log.info("repo_design_github stage=%s message=%s", stage, message[:80])

    scene, meta, cached = await design_from_repo(
        gateway,
        github_url=body.github_url,
        github_token=github_token,
        on_progress=progress,
    )
    audit(db, "repo_design.github", source=meta.source, sha=meta.commit_sha[:8], cached=cached)
    return {
        "scene": scene,
        "provider": meta.source,
        "model": gateway.settings.model_planner,
        "cached": cached,
    }


@router.post("/repo-design/workspace", response_model=SceneResponse, dependencies=[Depends(repo_limit)])
async def design_from_workspace(body: WorkspaceDesignRequest, request: Request, db: Session = Depends(get_db)):
    """Generate a 3D scene from an authorized local workspace."""
    provider = request.app.state.provider
    if provider.is_demo or not provider.configured:
        raise AppError(
            "scene_generation_unavailable",
            "Connect a model provider (NVIDIA_API_KEY) to generate workspace scenes.",
            503,
        )

    workspace = db.get(Workspace, body.workspace_id)
    if workspace is None:
        raise AppError("not_found", "Workspace not found.", 404)

    gateway = request.app.state.model_gateway

    async def progress(stage: str, message: str) -> None:
        log.info("repo_design_workspace stage=%s message=%s", stage, message[:80])

    scene, meta, cached = await design_from_repo(
        gateway,
        workspace_path=workspace.path,
        on_progress=progress,
    )
    audit(db, "repo_design.workspace", workspace_id=workspace.id, sha=meta.commit_sha[:8], cached=cached)
    return {
        "scene": scene,
        "provider": meta.source,
        "model": gateway.settings.model_planner,
        "cached": cached,
    }
