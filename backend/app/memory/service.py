"""User-approved memory writes, importance gating, semantic dedupe, and retrieval."""

import json
import math
import re
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import Memory
from app.services.model_gateway import ModelGateway

MEMORY_TYPES = {"USER", "PROJECT", "TASK", "PREFERENCE", "DECISION", "EVENT", "CODE_CONTEXT", "VISION"}
_STOP = {"the", "and", "for", "with", "that", "this", "what", "how", "are", "you", "can", "does", "from", "about", "have", "was", "will", "into", "please"}
_SMALL_TALK = {"hi", "hello", "hey", "thanks", "thank you", "thanks so much", "good morning", "good night", "bye", "ok", "okay", "cool", "great", "lol", "haha"}


def _tokens(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9_]+", text.lower()) if len(token) > 2 and token not in _STOP}


def _cosine(left: list[float] | None, right: list[float] | None) -> float | None:
    if not left or not right or len(left) != len(right):
        return None
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    norm_l = math.sqrt(sum(a * a for a in left))
    norm_r = math.sqrt(sum(b * b for b in right))
    return dot / (norm_l * norm_r) if norm_l and norm_r else 0.0


def _lexical_similarity(left: str, right: str) -> float:
    a, b = _tokens(left), _tokens(right)
    return len(a & b) / len(a | b) if a and b else 0.0


def _is_small_talk(text: str) -> bool:
    normalized = " ".join(re.findall(r"[a-z]+", text.lower()))
    return normalized in _SMALL_TALK


async def _embed_async(gateway: ModelGateway | None, text: str) -> list[float] | None:
    if gateway is None:
        return None
    try:
        return (await gateway.embed([text]))[0]
    except AppError as error:
        if error.code in {"embedding_unavailable", "embedding_dimension_mismatch"}:
            return None
        raise


def _dedupe(db: Session, *, content: str, memory_type: str, vector: list[float] | None) -> Memory | None:
    for existing in db.scalars(select(Memory).where(Memory.type == memory_type)):
        similarity = _cosine(vector, existing.embedding)
        if similarity is None:
            similarity = _lexical_similarity(content, existing.content)
        if similarity > 0.92:
            return existing
    return None


async def store_user_memory(
    db: Session, content: str, memory_type: str, gateway: ModelGateway | None, source: str = "user"
) -> Memory:
    confirmed = source == "user"
    importance = 1.0 if confirmed else 0.5
    vector = await _embed_async(gateway, content)
    existing = _dedupe(db, content=content, memory_type=memory_type, vector=vector)
    if existing:
        if confirmed or not existing.confirmed:
            existing.content = content
        existing.source = source
        existing.confirmed = existing.confirmed or confirmed
        existing.importance = max(existing.importance, importance)
        existing.embedding = vector or existing.embedding
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        return existing
    memory = Memory(content=content, type=memory_type, source=source, confirmed=confirmed, importance=importance, embedding=vector)
    db.add(memory)
    db.commit()
    return memory


async def gate_and_suggest(db: Session, *, candidate: str, user_text: str, gateway: ModelGateway | None) -> Memory | None:
    """Store only durable facts the user explicitly stated, pending user confirmation."""
    if gateway is None or gateway.provider == "demo" or gateway.settings.mock_ai or gateway.settings.demo_mode:
        return None
    if _is_small_talk(user_text) or not candidate.strip():
        return None
    prompt = {
        "role": "user",
        "content": (
            "Decide whether the candidate is a durable fact explicitly stated by the user in their message. "
            "Never infer sensitive details. Reject greetings, thanks, questions, and temporary requests. "
            "Return only JSON: {\"store\": boolean, \"type\": one of "
            f"{sorted(MEMORY_TYPES)}, \"content\": concise string, \"importance\": number from 0 to 1}}.\n"
            f"User message: {user_text[:4000]}\nCandidate: {candidate[:1000]}"
        ),
    }
    try:
        result = await gateway.complete([{"role": "system", "content": "You are a strict memory importance gate."}, prompt], task="fast")
    except AppError:
        return None
    try:
        data = json.loads(result.text)
        memory_type = data["type"]
        content = str(data["content"]).strip()[:2000]
        importance = float(data["importance"])
        if not isinstance(data["store"], bool) or memory_type not in MEMORY_TYPES or not 0 <= importance <= 1:
            return None
        if not data["store"] or importance < 0.35 or not content or _is_small_talk(content):
            return None
    except (ValueError, TypeError, KeyError):
        return None
    vector = await _embed_async(gateway, content)
    existing = _dedupe(db, content=content, memory_type=memory_type, vector=vector)
    if existing:
        if existing.confirmed:
            return existing
        existing.content = content
        existing.source = "chat_suggestion"
        existing.importance = importance
        existing.embedding = vector or existing.embedding
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        return existing
    memory = Memory(content=content, type=memory_type, source="chat_suggestion", confirmed=False,
                    importance=importance, embedding=vector)
    db.add(memory)
    db.commit()
    return memory


async def retrieve_relevant(
    db: Session, query: str, gateway: ModelGateway | None = None, limit: int = 8
) -> list[Memory]:
    """Rank confirmed memories by cosine, importance, and access recency."""
    query_vector = None
    if gateway and gateway.provider != "demo" and not gateway.settings.mock_ai and not gateway.settings.demo_mode:
        query_vector = await _embed_async(gateway, query)
    now = datetime.now(timezone.utc)
    scored: list[tuple[float, Memory]] = []
    for memory in db.scalars(select(Memory).where(Memory.confirmed.is_(True))):
        lexical = _lexical_similarity(query, memory.content)
        similarity = _cosine(query_vector, memory.embedding) if query_vector else None
        if similarity is None:
            similarity = lexical
        if similarity <= 0.05:
            continue
        accessed = memory.last_accessed
        if accessed.tzinfo is None:
            accessed = accessed.replace(tzinfo=timezone.utc)
        age_days = max(0.0, (now - accessed).total_seconds() / 86400)
        recency = math.exp(-age_days / 30)
        score = 0.6 * max(0.0, similarity) + 0.25 * memory.importance + 0.15 * recency
        scored.append((score, memory))
    scored.sort(key=lambda item: (-item[0], -item[1].id))
    selected = [memory for _, memory in scored[:limit]]
    for memory in selected:
        memory.last_accessed = now
    return selected
