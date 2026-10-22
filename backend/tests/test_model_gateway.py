import asyncio

import httpx
import pytest

from app.config import Settings
from app.core.errors import AppError
from app.services.model_gateway import ModelGateway


def gateway(**kwargs):
    return ModelGateway(Settings(_env_file=None, **kwargs))


def mock_client(monkeypatch, handler):
    real_client = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs))


def test_gateway_routes_task_model_and_removes_reasoning(monkeypatch):
    seen = {}

    def respond(request):
        seen.update(request=request, body=request.read().decode())
        return httpx.Response(200, json={"choices": [{"message": {"content": "<think>private thought</think>Done"}}], "usage": {"prompt_tokens": 9, "completion_tokens": 2}})

    mock_client(monkeypatch, respond)
    result = asyncio.run(gateway(nebius_api_key="secret-test-key", model_fast="fast-test-model").complete([], task="fast"))
    assert result.text == "Done"
    assert result.model == "fast-test-model" and result.prompt_tokens == 9
    assert "fast-test-model" in seen["body"]
    assert seen["request"].headers["authorization"] == "Bearer secret-test-key"


def test_gateway_retries_server_error_once(monkeypatch):
    calls = 0

    def respond(_request):
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(503)
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    mock_client(monkeypatch, respond)
    result = asyncio.run(gateway(nebius_api_key="test", model_planner="planner", provider_retries=1).complete([]))
    assert result.text == "ok" and calls == 2


def test_gateway_embedding_falls_back_when_remote_dimension_is_wrong(monkeypatch):
    mock_client(monkeypatch, lambda _request: httpx.Response(200, json={"data": [{"embedding": [1.0, 2.0]}]}))
    instance = gateway(nebius_api_key="test", model_embed="embed", embedding_dimension=3)
    monkeypatch.setattr(instance, "_local_embeddings", lambda texts: [[0.1, 0.2, 0.3] for _ in texts])
    assert asyncio.run(instance.embed(["hello"])) == [[0.1, 0.2, 0.3]]


def test_gateway_embedding_falls_back_when_remote_model_is_missing(monkeypatch):
    mock_client(monkeypatch, lambda _request: httpx.Response(404))
    instance = gateway(nebius_api_key="test", model_embed="missing-embed", embedding_dimension=2)
    monkeypatch.setattr(instance, "_local_embeddings", lambda texts: [[0.4, 0.5] for _ in texts])
    assert asyncio.run(instance.embed(["hello"])) == [[0.4, 0.5]]


def test_gateway_returns_clear_error_for_reasoning_only(monkeypatch):
    mock_client(monkeypatch, lambda _request: httpx.Response(200, json={"choices": [{"message": {"content": "<think>only thought</think>"}}]}))
    with pytest.raises(AppError) as error:
        asyncio.run(gateway(nebius_api_key="test", model_planner="planner").complete([]))
    assert error.value.code == "provider_empty_response"


def test_gateway_streams_openai_compatible_deltas(monkeypatch):
    payload = (
        'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n'
        "data: [DONE]\n\n"
    )
    mock_client(monkeypatch, lambda _request: httpx.Response(200, text=payload))
    async def collect():
        return [chunk async for chunk in gateway(nebius_api_key="test", model_planner="planner").stream([])]
    assert asyncio.run(collect()) == ["hello", " world"]


def test_gateway_stream_does_not_emit_reasoning_tags(monkeypatch):
    payload = (
        'data: {"choices":[{"delta":{"content":"Before <thi"}}]}\n\n'
        'data: {"choices":[{"delta":{"content":"nk>private thought</think>After"}}]}\n\n'
        "data: [DONE]\n\n"
    )
    mock_client(monkeypatch, lambda _request: httpx.Response(200, text=payload))
    async def collect():
        return "".join([chunk async for chunk in gateway(nebius_api_key="test", model_planner="planner").stream([])])
    assert asyncio.run(collect()) == "Before After"


def test_model_names_are_required_per_task():
    with pytest.raises(AppError) as error:
        gateway().model_for("fast")
    assert error.value.code == "model_not_configured"
