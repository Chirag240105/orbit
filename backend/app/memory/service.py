import math
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Memory
from app.security.redaction import redact

_STOP = {"the", "and", "for", "with", "that", "this", "what", "how", "are", "you", "can", "does", "from", "about", "have", "was", "will", "into", "please"}


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9_]+", text.lower()) if len(t) > 2 and t not in _STOP}


def _stem(t: str) -> str:
    for suf in ("ing", "ed", "es", "s"):
        if t.endswith(suf) and len(t) - len(suf) >= 3:
            return t[: -len(suf)]
    return t


def _stems(text: str) -> list[str]:
    return [_stem(t) for t in re.findall(r"[a-z0-9_]+", text.lower()) if len(t) > 2 and t not in _STOP]


def score_keyword(query: str, docs: list[str]) -> list[float]:
    q = _tokens(query)
    return [float(len(q & _tokens(d))) for d in docs]


def score_keyword_stem(query: str, docs: list[str]) -> list[float]:
    q = set(_stems(query))
    return [float(len(q & set(_stems(d)))) for d in docs]


def score_bm25(query: str, docs: list[str], k1: float = 1.2, b: float = 0.75) -> list[float]:
    q, toks = set(_stems(query)), [_stems(d) for d in docs]
    n, avg = len(docs), (sum(map(len, toks)) / len(docs)) if docs else 1.0
    df = {t: sum(1 for d in toks if t in d) for t in q}
    out = []
    for d in toks:
        s = 0.0
        for t in q:
            f = d.count(t)
            if f:
                s += math.log(1 + (n - df[t] + 0.5) / (df[t] + 0.5)) * f * (k1 + 1) / (f + k1 * (1 - b + b * len(d) / (avg or 1)))
        out.append(s)
    return out


SCORERS = {"keyword": score_keyword, "keyword_stem": score_keyword_stem, "bm25": score_bm25}
# Chosen by the labeled evaluation in tests/test_memory_eval.py (results in docs/MEMORY_DESIGN.md).
DEFAULT_METHOD = "keyword_stem"  # 0.95 recall@3 vs 0.80 for plain keywords; BM25 tied, so the simpler one


def retrieve_relevant(db: Session, query: str, limit: int = 5, method: str = DEFAULT_METHOD) -> list[Memory]:
    """Retrieval over user-confirmed memories only."""
    mems = list(db.scalars(select(Memory).where(Memory.confirmed.is_(True))))
    scores = SCORERS[method](query, [m.content for m in mems])
    ranked = sorted(((s, m) for s, m in zip(scores, mems, strict=True) if s > 0), key=lambda p: (-p[0], -p[1].id))
    return [m for _, m in ranked[:limit]]


# ---------- memory suggestions (AI-07) ----------
_SENSITIVE = re.compile(
    r"\b(passw|passcode|pin code|ssn|social security|credit card|card number|cvv|bank account|iban|salary|debt|loan|"
    r"diagnos|disease|illness|disorder|medicat|therap|pregnan|religio|church|mosque|temple|sexual|gay|lesbian|"
    r"bisexual|transgender|politic|voted|voting|ethnic|immigra|visa status|criminal|arrest|convict)\w*",
    re.I,
)
_META = {"user", "users", "they", "their", "them", "prefer", "prefers", "like", "likes", "want", "wants", "always", "usually"}


def vet_suggestion(suggestion: object, user_message: str) -> str | None:
    """Keep a model-suggested memory only if it is short, not sensitive, contains no secret, and is grounded in
    what the user actually wrote (at least half of its words come from the user's message)."""
    if not isinstance(suggestion, str):
        return None
    s = suggestion.strip()
    if not s or len(s) > 300 or redact(s)[1] or _SENSITIVE.search(s):
        return None
    words = {w for w in _stems(s) if w not in _META}
    said = set(_stems(user_message))
    if not words:
        return None
    overlap = len(words & said)
    if overlap < min(2, len(words)) or overlap / len(words) < 0.5:
        return None
    return s
