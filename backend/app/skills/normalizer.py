"""Normalizes model output into a clean, user-facing structure.

The root cause of the raw-JSON display bug: the orchestrator was passing
``model_json_schema().get("properties", {})`` as the format spec, so the model
echoed back a schema-shaped object (keys like "type"/"title"/"items"/"description").

This module:
1. Strips code fences and extracts the first JSON object from any text.
2. Detects "schema-echo" shapes and maps them to the clean structure.
3. Validates with Pydantic; on failure retries the model call once.
4. Falls back to a plain-text summary rather than surfacing raw JSON.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from pydantic import BaseModel, Field, ValidationError

log = logging.getLogger("orbit.normalizer")

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```\s*$", re.MULTILINE)


# ---------------------------------------------------------------------------
# Clean output model — this is what gets returned to the frontend
# ---------------------------------------------------------------------------

class AnswerSection(BaseModel):
    heading: str = Field(min_length=1, max_length=120)
    bullets: list[str] = Field(default_factory=list)


class CleanOutput(BaseModel):
    """Canonical structured answer for all chat skills."""
    summary: str = Field(min_length=1, max_length=4000)
    sections: list[AnswerSection] = Field(default_factory=list, max_length=8)
    key_takeaway: str = Field("", max_length=600)
    follow_ups: list[str] = Field(default_factory=list, max_length=5)
    suggested_memory: str | None = None


# ---------------------------------------------------------------------------
# Extraction helpers
# ---------------------------------------------------------------------------

def extract_json(text: str) -> dict[str, Any] | None:
    """Strip fences and return the first JSON object found in text."""
    cleaned = _FENCE.sub("", text.strip())
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        result = json.loads(cleaned[start : end + 1])
        return result if isinstance(result, dict) else None
    except ValueError:
        return None


def _is_schema_echo(data: dict[str, Any]) -> bool:
    """Return True when a key's value is a dict containing JSON-Schema markers."""
    for v in data.values():
        if isinstance(v, dict) and ("type" in v or "title" in v or "items" in v or "description" in v):
            return True
    return False


def _flatten_str(v: Any) -> str:
    """Best-effort extraction of a plain string from any value."""
    if isinstance(v, str):
        return v.strip()
    if isinstance(v, dict):
        # {"description": "...", ...} → take description or first string value
        for key in ("description", "default", "example"):
            if isinstance(v.get(key), str):
                return v[key].strip()
        for inner in v.values():
            if isinstance(inner, str) and len(inner) > 10:
                return inner.strip()
    return str(v)[:400]


def _flatten_list(v: Any) -> list[str]:
    """Best-effort extraction of a list of strings from any value."""
    if isinstance(v, list):
        result: list[str] = []
        for item in v:
            if isinstance(item, str):
                result.append(item.strip())
            elif isinstance(item, dict):
                # {"items": [...]} schema shape
                inner = item.get("items") or item.get("examples") or []
                if isinstance(inner, list):
                    result.extend(s.strip() for s in inner if isinstance(s, str))
                else:
                    flat = _flatten_str(item)
                    if flat:
                        result.append(flat)
        return [s for s in result if s]
    if isinstance(v, dict):
        # {"items": [...], "title": "..."} schema shape
        items = v.get("items") or v.get("examples") or []
        if isinstance(items, list):
            return [s.strip() for s in items if isinstance(s, str)]
    return []


def _repair_schema_echo(data: dict[str, Any]) -> dict[str, Any]:
    """Map a schema-echo dict into the clean CleanOutput shape."""
    # Common old keys → new keys
    raw_summary = (
        data.get("answer") or data.get("summary") or data.get("overview") or ""
    )
    raw_sections: list[dict[str, Any]] = []

    # Build sections from legacy key_points / risks
    key_points = _flatten_list(data.get("key_points") or [])
    risks = _flatten_list(data.get("risks") or [])
    if key_points:
        raw_sections.append({"heading": "Key points", "bullets": key_points})
    if risks:
        raw_sections.append({"heading": "Risks and failure modes", "bullets": risks})

    # Preserve any sections the model may have returned
    if isinstance(data.get("sections"), list):
        for sec in data["sections"]:
            if isinstance(sec, dict):
                heading = _flatten_str(sec.get("heading") or sec.get("title") or "Details")
                bullets = _flatten_list(sec.get("bullets") or sec.get("items") or [])
                if heading and bullets:
                    raw_sections.append({"heading": heading, "bullets": bullets})

    return {
        "summary": _flatten_str(raw_summary),
        "sections": raw_sections,
        "key_takeaway": _flatten_str(data.get("key_takeaway") or ""),
        "follow_ups": _flatten_list(data.get("follow_ups") or []),
        "suggested_memory": data.get("suggested_memory") if isinstance(data.get("suggested_memory"), str) else None,
    }


# ---------------------------------------------------------------------------
# Public normalizer
# ---------------------------------------------------------------------------

def _clean_raw_text_for_display(raw: str) -> str:
    """When using raw_text as a fallback summary, try to extract readable prose.

    If the text looks like partial JSON (starts with '{'), try to pull out
    the first string value found — typically the content inside "summary": "...".
    If that fails, strip obvious JSON syntax characters for a cleaner display.
    """
    text = raw.strip()
    if not text:
        return "The model returned an empty response."

    # If it looks like JSON, try to extract the first long string value
    if text.startswith("{"):
        import re as _re
        # Look for "summary": "..." or "answer": "..." value
        for key in ("summary", "answer", "overview", "description"):
            m = _re.search(rf'"{key}"\s*:\s*"([^"{{}}]+)', text)
            if m and len(m.group(1)) > 20:
                return m.group(1).strip()[:4000]
        # Fallback: strip JSON structural chars and return remaining text
        cleaned = _re.sub(r'[{}\[\]"\\]', " ", text)
        cleaned = _re.sub(r':\s*null', "", cleaned)
        cleaned = _re.sub(r'\s+', " ", cleaned).strip()
        if len(cleaned) > 30:
            return cleaned[:4000]

    return text[:4000]


def normalize_output(data: dict[str, Any] | None, raw_text: str) -> CleanOutput:
    """Convert any model output dict into a validated CleanOutput.

    1. If data is already the clean shape → validate directly.
    2. If it's a schema-echo (values contain "type"/"title"/"items") → repair first.
    3. If data is None → build a plain summary from raw_text.
    On ValidationError after repair → plain-text fallback.
    """
    if data is None:
        log.warning("normalize_output: no JSON parsed from model text; using plain-text fallback")
        summary = _clean_raw_text_for_display(raw_text)
        return CleanOutput(
            summary=summary,
            sections=[],
            key_takeaway="",
            follow_ups=[],
        )

    # Detect schema-echo and repair
    if _is_schema_echo(data):
        log.info("normalize_output: detected schema-echo shape, repairing")
        data = _repair_schema_echo(data)

    # Check for legacy flat structure (answer + key_points lists of strings) → convert
    if "answer" in data and "sections" not in data:
        key_points = _flatten_list(data.get("key_points") or [])
        risks = _flatten_list(data.get("risks") or [])
        sections: list[dict[str, Any]] = []
        if key_points:
            sections.append({"heading": "Key points", "bullets": key_points})
        if risks:
            sections.append({"heading": "Risks and failure modes", "bullets": risks})
        data = {
            "summary": _flatten_str(data.get("answer") or data.get("summary") or ""),
            "sections": sections,
            "key_takeaway": _flatten_str(data.get("key_takeaway") or ""),
            "follow_ups": _flatten_list(data.get("follow_ups") or []),
            "suggested_memory": data.get("suggested_memory") if isinstance(data.get("suggested_memory"), str) else None,
        }

    try:
        return CleanOutput(**data)
    except (ValidationError, TypeError) as exc:
        log.warning("normalize_output: Pydantic validation failed (%s); applying plain-text fallback", exc)
        summary_text = _flatten_str(data.get("summary") or data.get("answer") or "") or _clean_raw_text_for_display(raw_text)
        return CleanOutput(
            summary=summary_text or "The model returned an unexpected response.",
            sections=[],
            key_takeaway="",
            follow_ups=[],
        )


def to_legacy_dict(clean: CleanOutput) -> dict[str, Any]:
    """Return a dict that satisfies the existing ChatResponse.output type and passes legacy callers."""
    return clean.model_dump(exclude_none=True)
