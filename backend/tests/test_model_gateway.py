import asyncio
import json
import pathlib
import subprocess

import httpx
import pytest

from app.config import Settings
from app.core.errors import AppError
from app.services.model_gateway import ModelGateway


def make_gateway(**kwargs):
    return ModelGateway(Settings(_env_file=None, **kwargs))


def mock_client(monkeypatch, handler):
    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )


def test_startup_rejects_removed_provider_value():
    removed_provider = "ge" + "mini"
    with pytest.raises(ValueError) as exc:
        Settings(_env_file=None, llm_provider=removed_provider)
    assert "is no longer supported. Use 'nvidia' (default), 'nebius', or 'demo'." in str(exc.value)


def test_gateway_routes_task_model_and_toggles_thinking(monkeypatch):
    seen = {}

    def respond(request):
        seen["request"] = request
        seen["body"] = request.read().decode()
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "ok", "reasoning_content": "plan steps"}}],
                "usage": {"prompt_tokens": 12, "completion_tokens": 4},
            },
        )

    mock_client(monkeypatch, respond)
    gw = make_gateway(
        nvidia_api_key="secret-test-key",
        model_planner="planner-model",
        model_fast="fast-model",
    )

    # Chat task -> model_planner, thinking enabled
    res = asyncio.run(gw.complete([{"role": "user", "content": "hi"}], task="chat"))
    assert res.model == "planner-model"
    body_chat = json.loads(seen["body"])
    assert body_chat["chat_template_kwargs"]["enable_thinking"] is True

    # JSON task -> thinking disabled
    res_json = asyncio.run(gw.complete([{"role": "user", "content": "hi"}], task="scene_generation"))
    assert res_json.model == "planner-model"
    body_scene = json.loads(seen["body"])
    assert body_scene["chat_template_kwargs"]["enable_thinking"] is False


def test_gateway_fallback_chain_order_on_error(monkeypatch):
    attempted_models = []

    def respond(request):
        body = httpx.Response(200, text=request.read().decode()).json()
        model = body["model"]
        attempted_models.append(model)
        if model == "super-3.5":
            return httpx.Response(500, json={"error": "overloaded"})
        if model == "super-3-fallback":
            return httpx.Response(404, json={"error": "not found"})
        if model == "fast-lightning":
            return httpx.Response(200, json={"choices": [{"message": {"content": "emergency recovery"}}]})
        return httpx.Response(500)

    mock_client(monkeypatch, respond)
    gw = make_gateway(
        nvidia_api_key="test-key",
        model_planner="super-3.5",
        model_fallback="super-3-fallback",
        model_fast="fast-lightning",
    )

    result = asyncio.run(gw.complete([{"role": "user", "content": "hello"}], task="chat"))
    assert result.text == "emergency recovery"
    assert attempted_models == ["super-3.5", "super-3-fallback", "fast-lightning"]


def test_fallback_chains_respect_task_kind():
    gw = make_gateway(
        nvidia_api_key="test-key",
        model_planner="planner",
        model_fallback="fallback",
        model_fast="fast",
    )
    assert gw.fallback_chain_for("chat") == ["planner", "fallback", "fast"]
    assert gw.fallback_chain_for("scene_generation") == ["planner", "fallback"]
    assert gw.fallback_chain_for("fast") == ["fast", "planner", "fallback"]


def test_gateway_429_backs_off_and_falls_back(monkeypatch):
    calls_429 = 0

    async def no_wait(_seconds):
        return None

    monkeypatch.setattr(asyncio, "sleep", no_wait)

    def respond(request):
        nonlocal calls_429
        body = httpx.Response(200, text=request.read().decode()).json()
        if body["model"] == "super-3.5":
            calls_429 += 1
            return httpx.Response(429, json={"error": "rate limit"})
        return httpx.Response(200, json={"choices": [{"message": {"content": "fallback success"}}]})

    mock_client(monkeypatch, respond)
    gw = make_gateway(
        nvidia_api_key="test-key",
        model_planner="super-3.5",
        model_fallback="super-3-fallback",
        model_fast="fast-lightning",
    )

    result = asyncio.run(gw.complete([{"role": "user", "content": "test"}], task="chat"))
    assert result.text == "fallback success"
    # A single backoff/retry occurs before the request advances to the next model.
    assert calls_429 == 2


def test_gateway_reports_unavailable_after_all_models_fail(monkeypatch):
    mock_client(monkeypatch, lambda _request: httpx.Response(503, json={"error": "unavailable"}))
    gw = make_gateway(
        nvidia_api_key="test-key",
        model_planner="planner",
        model_fallback="fallback",
        model_fast="fast",
    )
    with pytest.raises(AppError) as err:
        asyncio.run(gw.complete([{"role": "user", "content": "hello"}], task="chat"))
    assert err.value.code == "provider_unavailable"
    assert "AI service temporarily unavailable" in err.value.message


def test_gateway_embedding_with_input_type(monkeypatch):
    seen = {}

    def respond(request):
        seen["payload"] = httpx.Response(200, text=request.read().decode()).json()
        return httpx.Response(
            200,
            json={"data": [{"embedding": [0.1] * 2048}]},
        )

    mock_client(monkeypatch, respond)
    gw = make_gateway(
        nvidia_api_key="test-key",
        model_embed="nemotron-embed",
        embedding_dimension=2048,
    )

    vecs = asyncio.run(gw.embed(["search query"], input_type="query"))
    assert len(vecs) == 1
    assert len(vecs[0]) == 2048
    assert seen["payload"]["input_type"] == "query"
    assert seen["payload"]["model"] == "nemotron-embed"


def test_gateway_streams_reasoning_and_content_separately(monkeypatch):
    payload = (
        'data: {"choices":[{"delta":{"reasoning_content":"Thinking..."}}]}\n\n'
        'data: {"choices":[{"delta":{"content":"Answer"}}]}\n\n'
        "data: [DONE]\n\n"
    )
    mock_client(monkeypatch, lambda _req: httpx.Response(200, text=payload))
    gw = make_gateway(nvidia_api_key="test", model_planner="planner")

    async def collect():
        items = []
        async for kind, text in gw.stream_deltas([{"role": "user", "content": "hi"}], task="chat"):
            if kind != "model":
                items.append((kind, text))
        return items

    deltas = asyncio.run(collect())
    assert deltas == [("reasoning", "Thinking..."), ("content", "Answer")]


def test_stream_429_retries_then_falls_back(monkeypatch):
    attempted = []
    sleeps = []

    async def no_wait(seconds):
        sleeps.append(seconds)

    def respond(request):
        body = httpx.Response(200, text=request.read().decode()).json()
        model = body["model"]
        attempted.append(model)
        if model == "planner":
            return httpx.Response(429, json={"error": "rate limit"})
        return httpx.Response(
            200,
            text='data: {"choices":[{"delta":{"content":"Recovered"}}]}\n\n'
            "data: [DONE]\n\n",
        )

    monkeypatch.setattr(asyncio, "sleep", no_wait)
    mock_client(monkeypatch, respond)
    gw = make_gateway(
        nvidia_api_key="test-key",
        model_planner="planner",
        model_fallback="fallback",
        model_fast="fast",
    )

    async def collect():
        return [item async for item in gw.stream_deltas(
            [{"role": "user", "content": "hi"}], task="chat"
        )]

    deltas = asyncio.run(collect())
    assert attempted == ["planner", "planner", "fallback"]
    assert sleeps == [1.0]
    assert ("model", "fallback") in deltas
    assert "".join(text for kind, text in deltas if kind == "content") == "Recovered"


def test_no_forbidden_provider_strings_in_repo():
    """Acceptance test A11: tracked source and config files must contain no removed-provider markers.

    Documentation files (*.md) are excluded because they may legitimately reference
    removed providers in the context of explaining what was removed or why.
    """
    repo_root = pathlib.Path(__file__).resolve().parents[2]
    proc = subprocess.run(
        ["git", "ls-files", "-z"], cwd=str(repo_root), capture_output=True, check=True
    )
    forbidden = ["ge" + "mini", "goo" + "gle", "gen" + "ai", "AI" + "za"]
    # Extensions that must be clean: source code, config, environment templates.
    # Markdown docs are excluded because they may explain the removal in prose.
    clean_extensions = {
        ".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".toml", ".ini",
        ".yml", ".yaml", ".sh", ".env", ".example",
    }
    violations = []

    for raw_path in proc.stdout.split(b"\0"):
        if not raw_path:
            continue
        rel_path = raw_path.decode()
        full_path = repo_root / rel_path
        if not full_path.is_file():
            continue
        # Only check source and config files, not documentation
        if full_path.suffix.lower() not in clean_extensions and full_path.name not in (".env.example",):
            continue
        content = full_path.read_text(encoding="utf-8", errors="ignore")
        for term in forbidden:
            if term.lower() in content.lower():
                violations.append(f"{rel_path}: matches '{term}'")

    assert not violations, f"Forbidden strings found in tracked files: {violations}"
