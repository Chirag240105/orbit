import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Memory

_STOP = {"the", "and", "for", "with", "that", "this", "what", "how", "are", "you", "can", "does", "from", "about", "have", "was", "will", "into", "please"}


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9_]+", text.lower()) if len(t) > 2 and t not in _STOP}


def retrieve_relevant(db: Session, query: str, limit: int = 5) -> list[Memory]:
    """Keyword-overlap retrieval over user-confirmed memories only. Embeddings are a future task (AI-06)."""
    q = _tokens(query)
    scored = []
    for m in db.scalars(select(Memory).where(Memory.confirmed.is_(True))):
        score = len(q & _tokens(m.content))
        if score:
            scored.append((score, m))
    scored.sort(key=lambda s: (-s[0], -s[1].id))
    return [m for _, m in scored[:limit]]
