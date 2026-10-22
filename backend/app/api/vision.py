from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.log import audit
from app.auth import get_current_user
from app.db.session import get_db
from app.memory.service import store_user_memory
from app.models import Project
from app.schemas import MemoryOut, VisionContextIn

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])


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
