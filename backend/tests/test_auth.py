"""SEC-01: local API token."""
import logging

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import create_app
from tests.conftest import TOKEN, make_settings


def test_missing_or_wrong_token_is_401():
    c = TestClient(create_app(make_settings()), raise_server_exceptions=False)
    r = c.get("/api/memories")
    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"
    assert c.get("/api/memories", headers={"X-Orbit-Token": "x" * 32}).status_code == 401
    assert c.post("/api/chat", json={"message": "hi"}).status_code == 401
    assert c.get("/api/memories", headers={"X-Orbit-Token": TOKEN}).status_code == 200


def test_health_and_docs_need_no_token():
    c = TestClient(create_app(make_settings()))
    assert c.get("/api/health").status_code == 200
    assert c.get("/api/openapi.json").status_code == 200


def test_generated_token_is_written_but_never_logged(tmp_path, caplog):
    f = tmp_path / "token"
    with caplog.at_level(logging.DEBUG):
        app = create_app(Settings(database_url="sqlite://", _env_file=None, token_file=str(f)))
    token = f.read_text()
    assert len(token) >= 32 and token not in caplog.text
    assert TestClient(app).get("/api/skills", headers={"X-Orbit-Token": token}).status_code == 200


def test_each_start_gets_a_new_token(tmp_path):
    f = tmp_path / "token"
    create_app(Settings(database_url="sqlite://", _env_file=None, token_file=str(f)))
    first = f.read_text()
    create_app(Settings(database_url="sqlite://", _env_file=None, token_file=str(f)))
    assert f.read_text() != first


def test_weak_configured_token_is_rejected():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, api_token="short")


def test_cors_preflight_allows_token_header(client):
    r = client.options("/api/memories", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "x-orbit-token"})
    assert r.status_code == 200 and "x-orbit-token" in r.headers.get("access-control-allow-headers", "").lower()
