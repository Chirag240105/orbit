from sqlalchemy.orm import Session

from app.models import AuditLog


def audit(db: Session, action: str, **detail: str | int | bool | None) -> None:
    """Record WHAT happened, never file contents, prompts, or secrets."""
    clean = {k: (v[:200] if isinstance(v, str) else v) for k, v in detail.items()}
    db.add(AuditLog(action=action, detail=clean))
    db.commit()
