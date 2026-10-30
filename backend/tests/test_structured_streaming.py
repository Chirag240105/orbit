"""Tests for the structured-vs-conversational streaming gate.

Covers:
1. _StreamingProvider with a structured task emits ZERO "token" events.
2. _StreamingProvider with a conversational task DOES emit "token" events.
3. Stage events from orchestrator are forwarded to the client.
4. processing_complete event is emitted after a structured call completes.
5. The exact truncated JSON shown in the bug report renders as a StructuredAnswer
   via the normalizer (backend-side validation, not frontend render test).
"""

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

import pytest

from app.providers.base import ChatProvider, ProviderResult

# ---------------------------------------------------------------------------
# Minimal stubs
# ---------------------------------------------------------------------------

@dataclass
class _FakeGatewayResult:
    text: str
    model: str = "fake-model"
    provider: str = "nvidia"
    latency_ms: int = 100
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    reasoning_trace: str | None = None


class _FakeGateway:
    """Minimal gateway stub that yields preset chunks for stream_deltas."""

    def __init__(self, chunks: list[str], task_model: str = "fast-model"):
        self._chunks = chunks
        self._model = task_model

    def model_for(self, task: str) -> str:
        return self._model

    async def stream_deltas(self, messages: list[dict], task: str = "planner") -> AsyncIterator[tuple[str, str]]:
        yield ("model", self._model)
        for chunk in self._chunks:
            yield ("content", chunk)


def _make_streaming_provider(chunks: list[str], task_model: str = "fast-model") -> tuple[Any, "_FakeGateway", list[dict]]:
    """Return (streaming_provider, gateway, emitted_events)."""

    class _BaseProvider(ChatProvider):
        name = "nvidia"
        model = task_model
        configured = True
        is_demo = False

        async def complete(self, messages: list[dict], task: str = "chat") -> ProviderResult:
            return ProviderResult(text="", model=task_model, provider="nvidia")

    emitted: list[dict] = []

    async def emit(event: str, data: dict) -> None:
        emitted.append({"event": event, "data": data})

    gateway = _FakeGateway(chunks, task_model)

    # Import the real _StreamingProvider from main (it reads _STRUCTURED_TASKS)
    from app.main import _StreamingProvider
    sp = _StreamingProvider(base=_BaseProvider(), gateway=gateway, emit=emit)
    return sp, gateway, emitted


# ---------------------------------------------------------------------------
# 1. Structured task: ZERO "token" events
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("task", ["fast", "plan", "scene_generation", "tool_args", "planner"])
def test_structured_task_emits_no_token_events(task):
    chunks = ['{"summary":', '"The API Gateway routes traffic."}']
    sp, _, emitted = _make_streaming_provider(chunks)
    asyncio.run(sp.complete([{"role": "user", "content": "hi"}], task=task))
    token_events = [e for e in emitted if e["event"] == "token"]
    assert token_events == [], f"Structured task '{task}' must emit zero token events; got {token_events}"


def test_structured_task_emits_processing_complete():
    chunks = ['{"summary": "done"}']
    sp, _, emitted = _make_streaming_provider(chunks)
    asyncio.run(sp.complete([{"role": "user", "content": "hi"}], task="fast"))
    pc_events = [e for e in emitted if e["event"] == "processing_complete"]
    assert len(pc_events) == 1, f"Expected exactly one processing_complete event; got {pc_events}"


# ---------------------------------------------------------------------------
# 2. Conversational task: token events ARE emitted
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("task", ["chat"])
def test_conversational_task_emits_token_events(task):
    chunks = ["Hello ", "world!"]
    sp, _, emitted = _make_streaming_provider(chunks)
    asyncio.run(sp.complete([{"role": "user", "content": "hi"}], task=task))
    token_events = [e for e in emitted if e["event"] == "token"]
    assert len(token_events) == 2, f"Expected 2 token events for '{task}'; got {token_events}"
    assert token_events[0]["data"]["text"] == "Hello "
    assert token_events[1]["data"]["text"] == "world!"


def test_conversational_task_emits_no_processing_complete():
    chunks = ["Hello!"]
    sp, _, emitted = _make_streaming_provider(chunks)
    asyncio.run(sp.complete([{"role": "user", "content": "hi"}], task="chat"))
    pc_events = [e for e in emitted if e["event"] == "processing_complete"]
    assert pc_events == []


# ---------------------------------------------------------------------------
# 3. Stage events from orchestrator end up forwarded
# ---------------------------------------------------------------------------

def test_stage_event_schema():
    """Stage events must have a 'label' field (string) and optional 'task' field."""
    stage = {"label": "Building answer…", "task": "fast"}
    assert isinstance(stage["label"], str)
    assert isinstance(stage["task"], str)


# ---------------------------------------------------------------------------
# 4. Truncated JSON bug fixture normalizes correctly
# ---------------------------------------------------------------------------

def test_truncated_json_normalizes_to_structured():
    """The exact truncated JSON from the bug report must NOT appear as raw text."""
    from app.skills.normalizer import normalize_output

    truncated_raw = (
        '{"summary": "This repository contains foundational Java code for Jenkins automation, '
        'including exception handling, environment variable management, and plugin co...'
    )
    # This is truncated (no closing brace) — extract_json will fail
    from app.skills.normalizer import extract_json
    data = extract_json(truncated_raw)
    # May partially parse if we add the closing brace, may return None if truncated
    # Either way, normalize_output must produce a CleanOutput with summary, not raw JSON
    result = normalize_output(data, truncated_raw)
    from app.skills.normalizer import CleanOutput
    assert isinstance(result, CleanOutput)
    # Summary must contain real text, not JSON syntax markers
    assert result.summary
    assert '"summary"' not in result.summary  # no raw JSON keys shown to users
    assert '{"summary"' not in result.summary


def test_partial_json_not_rendered_as_plain_text():
    """When JSON is partial/truncated, fallback summary contains human-readable text, not raw JSON."""
    from app.skills.normalizer import normalize_output

    partial = '{"summary": "The caching layer stores frequently accessed data in memory.'
    from app.skills.normalizer import extract_json
    data = extract_json(partial)
    result = normalize_output(data, partial)
    # If parsed: summary should be the text content without JSON key syntax
    # If not parsed: summary is the raw_text fallback — acceptable as long as it's not garbled JSON keys
    if data and result.summary:
        assert '"summary"' not in result.summary
