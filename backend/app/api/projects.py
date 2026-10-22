from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.core.errors import AppError
from app.db.session import get_db
from app.models import Memory, Note, Project
from app.schemas import NoteIn, NoteOut, NotePatch, ProjectIn, ProjectOut, ProjectPatch

router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])


def _require_project(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise AppError("not_found", "Project not found.", 404)
    return project

@router.get("/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.scalars(select(Project).order_by(Project.created_at.desc(), Project.id.desc())).all()

@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectIn, db: Session = Depends(get_db)):
    project = Project(**body.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@router.patch("/projects/{project_id}", response_model=ProjectOut)
def patch_project(project_id: int, body: ProjectPatch, db: Session = Depends(get_db)):
    project = _require_project(db, project_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    db.commit()
    db.refresh(project)
    return project

@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = _require_project(db, project_id)
    # Keep project-linked records valid even when SQLite foreign-key enforcement
    # is disabled in the in-memory test database.
    db.query(Note).filter(Note.project_id == project_id).update({Note.project_id: None})
    db.query(Memory).filter(Memory.project_id == project_id).update({Memory.project_id: None})
    db.delete(project)
    db.commit()

@router.get("/notes", response_model=list[NoteOut])
def list_notes(project_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(Note).order_by(Note.updated_at.desc(), Note.id.desc())
    if project_id is not None:
        stmt = stmt.where(Note.project_id == project_id)
    return db.scalars(stmt).all()

@router.post("/notes", response_model=NoteOut, status_code=201)
def create_note(body: NoteIn, db: Session = Depends(get_db)):
    values = body.model_dump()
    if values["project_id"] is not None:
        _require_project(db, values["project_id"])
    note = Note(**values)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note

@router.patch("/notes/{note_id}", response_model=NoteOut)
def patch_note(note_id: int, body: NotePatch, db: Session = Depends(get_db)):
    note = db.get(Note, note_id)
    if note is None:
        raise AppError("not_found", "Note not found.", 404)
    values = body.model_dump(exclude_unset=True)
    if values.get("project_id") is not None:
        _require_project(db, values["project_id"])
    for key, value in values.items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return note

@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.get(Note, note_id)
    if note is None:
        raise AppError("not_found", "Note not found.", 404)
    db.delete(note)
    db.commit()
