from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.log import audit
from app.auth import get_current_user
from app.core.errors import AppError
from app.db.session import get_db
from app.memory.service import store_user_memory
from app.models import Memory
from app.schemas import MemoryIn, MemoryOut, MemoryPatch

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])


@router.get("/memory", response_model=list[MemoryOut], include_in_schema=False)
@router.get("/memories", response_model=list[MemoryOut])
def list_memories(q: str = "", db: Session = Depends(get_db)):
    stmt = select(Memory).order_by(Memory.updated_at.desc())
    if q.strip():
        stmt = stmt.where(Memory.content.ilike(f"%{q.strip()}%"))
    return db.scalars(stmt).all()

@router.post("/memories", response_model=MemoryOut, status_code=201)
async def create_memory(body: MemoryIn, request: Request, db: Session = Depends(get_db)):
    return await store_user_memory(db, body.content, body.type, request.app.state.model_gateway, body.source)

@router.patch("/memories/{mid}", response_model=MemoryOut)
def patch_memory(mid: int, body: MemoryPatch, db: Session = Depends(get_db)):
    m = db.get(Memory, mid)
    if m is None:
        raise AppError("not_found", "Memory not found.", 404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit()
    return m

@router.delete("/memories/{mid}", status_code=204)
def delete_memory(mid: int, db: Session = Depends(get_db)):
    m = db.get(Memory, mid)
    if m is None:
        raise AppError("not_found", "Memory not found.", 404)
    db.delete(m)
    db.commit()

@router.delete("/memories", status_code=204)
def delete_all_memories(db: Session = Depends(get_db)):
    db.query(Memory).delete()
    db.commit()
    audit(db, "memory.delete_all")
