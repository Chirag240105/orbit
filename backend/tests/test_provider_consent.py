import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import TOKEN, make_settings


def hosted_client(handler, **kw):
    app = create_app(make_settings(nebius_api_key="test-key-not-real", **kw))
    import app.providers.nebius as nb
    real = httpx.AsyncClient
    nb.httpx.AsyncClient = lambda **kw: real(transport=httpx.MockTransport(handler), **kw)
    return TestClient(app, raise_server_exceptions=False, headers={"X-Orbit-Token": TOKEN}), lambda: setattr(nb.httpx, "AsyncClient", real)


def ok(request):
    body = request.read().decode()
    assert "untrusted_data" in body or "user_request" in body
    assert "supersecretvalue123" not in body
    return httpx.Response(200, json={"choices": [{"message": {"content": '```json\n{"overview": "It prints hi", "key_points": [], "risks": []}\n```'}}]})


def test_consent_required_then_redacted_send(project):
    (project / "src" / "cfg.py").write_text('password = "supersecretvalue123"\n')
    c, restore = hosted_client(ok)
    try:
        ws = c.post("/api/workspaces", json={"path": str(project)}).json()
        body = {"message": "explain", "skill": "explain_code", "workspace_id": ws["id"], "file_paths": ["src/cfg.py"]}
        r = c.post("/api/chat", json=body)
        assert r.status_code == 409 and r.json()["error"]["code"] == "consent_required"
        assert r.json()["error"]["details"]["redactions"] >= 1
        j = c.post("/api/chat", json={**body, "consent_external": True}).json()
        assert j["output"]["overview"] == "It prints hi" and j["context"]["external"] is True
    finally:
        restore()


@pytest.mark.parametrize("status,code", [(401, "provider_auth_failed"), (429, "provider_rate_limited"), (500, "provider_error")])
def test_provider_errors_are_generic(status, code):
    c, restore = hosted_client(lambda r: httpx.Response(status, text="SECRET-BODY test-key-not-real"))
    try:
        r = c.post("/api/chat", json={"message": "hi"})
        assert r.json()["error"]["code"] == code and "SECRET-BODY" not in r.text and "test-key-not-real" not in r.text
    finally:
        restore()


def test_non_json_reply_falls_back_with_warning():
    c, restore = hosted_client(lambda r: httpx.Response(200, json={"choices": [{"message": {"content": "<think>x</think>Just text"}}]}))
    try:
        j = c.post("/api/chat", json={"message": "hi"}).json()
        assert j["output"]["answer"] == "Just text" and j["warnings"]
    finally:
        restore()


def test_empty_reasoning_only_reply_is_an_error():
    c, restore = hosted_client(lambda r: httpx.Response(200, json={"choices": [{"message": {"content": None, "reasoning_content": "hmm"}}]}))
    try:
        assert c.post("/api/chat", json={"message": "hi"}).json()["error"]["code"] == "provider_empty_response"
    finally:
        restore()
