from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.orchestrator import enabled_names
from app.auth import get_current_user
from app.core.errors import AppError
from app.db.session import get_db
from app.models import SkillSetting
from app.schemas import SkillOut, SkillPatch
from app.skills.base import SkillInput

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])


@router.get("/skills", response_model=list[SkillOut])
def skills(request: Request, db: Session = Depends(get_db)):
    reg = request.app.state.registry
    on = enabled_names(db, reg)
    return [
        SkillOut(name=s.name, title=s.title, description=s.description, required_permissions=list(s.required_permissions), requires_files=s.requires_files, enabled=s.name in on, input_schema=SkillInput.model_json_schema(), output_schema=s.output_model.model_json_schema())
        for s in reg.all()
    ]

@router.patch("/skills/{name}")
def toggle_skill(name: str, body: SkillPatch, request: Request, db: Session = Depends(get_db)):
    if request.app.state.registry.get(name) is None:
        raise AppError("not_found", "Skill not found.", 404)
    row = db.scalar(select(SkillSetting).where(SkillSetting.name == name)) or SkillSetting(name=name)
    row.enabled = body.enabled
    db.add(row)
    db.commit()
    return {"name": name, "enabled": row.enabled}
