from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.core.errors import AppError
from app.db.session import get_db
from app.models import Task
from app.schemas import TaskIn, TaskOut, TaskPatch

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    return db.scalars(select(Task).order_by(Task.id.desc())).all()

@router.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(body: TaskIn, db: Session = Depends(get_db)):
    t = Task(**body.model_dump())
    db.add(t)
    db.commit()
    return t

@router.patch("/tasks/{tid}", response_model=TaskOut)
def patch_task(tid: int, body: TaskPatch, db: Session = Depends(get_db)):
    t = db.get(Task, tid)
    if t is None:
        raise AppError("not_found", "Task not found.", 404)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    db.commit()
    return t

@router.delete("/tasks/{tid}", status_code=204)
def delete_task(tid: int, db: Session = Depends(get_db)):
    t = db.get(Task, tid)
    if t is None:
        raise AppError("not_found", "Task not found.", 404)
    db.delete(t)
    db.commit()
