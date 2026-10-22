from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.log import audit
from app.auth import get_current_user
from app.core.errors import AppError
from app.core.ratelimit import RateLimiter
from app.db.session import get_db
from app.memory.service import store_user_memory
from app.models import Project
from app.schemas import MemoryOut, SceneRequest, SceneResponse, VisionContextIn

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])
scene_limit = RateLimiter(limit=10, window_s=60)


@router.post("/vision/context", response_model=MemoryOut, status_code=201)
async def save_vision_context(body: VisionContextIn, request: Request, db: Session = Depends(get_db)):
    name = body.project_name.strip()
    project = db.scalar(select(Project).where(Project.name == name))
    if project is None:
        project = Project(name=name, description="Created from an explicitly remembered visual learning context.")
        db.add(project)
        db.commit()
    memory = await store_user_memory(db, body.content, "VISION", request.app.state.model_gateway)
    memory.project_id = project.id
    db.commit()
    audit(db, "vision.context_saved", project_id=project.id, memory_id=memory.id)
    return memory


@router.post("/vision/scene", response_model=SceneResponse, dependencies=[Depends(scene_limit)])
async def generate_scene(body: SceneRequest, request: Request):
    """Designs any named system with the configured model, for the 3D Visual Learning Studio."""
    provider = request.app.state.provider
    if provider.is_demo or not provider.configured:
        raise AppError("scene_generation_unavailable", "Connect a model provider (for example GEMINI_API_KEY) to generate new systems.", 503)
    scene, cached = await request.app.state.scene_generator.generate(body.topic.strip())
    return {"scene": scene, "provider": provider.name, "model": provider.model, "cached": cached}
