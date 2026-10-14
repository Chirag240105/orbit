import json
from contextlib import contextmanager

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

TOKEN = "test-token-0123456789abcdefghij"


def make_settings(**kw) -> Settings:
    return Settings(database_url="sqlite://", _env_file=None, api_token=TOKEN, token_file="", **kw)


def make_client(**kw) -> TestClient:
    return TestClient(create_app(make_settings(**kw)), raise_server_exceptions=False, headers={"X-Orbit-Token": TOKEN})


def reply(text: str | None) -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": text}}]})


def sse_reply(*deltas: dict) -> httpx.Response:
    body = "".join(f"data: {json.dumps({'choices': [{'delta': d}]})}\n\n" for d in deltas) + "data: [DONE]\n\n"
    return httpx.Response(200, content=body.encode(), headers={"content-type": "text/event-stream"})


class FakeModel:
    """Scripted hosted model: returns the queued replies in order and records every request body."""

    def __init__(self, *replies: str | httpx.Response):
        self.replies, self.requests = list(replies), []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(json.loads(request.read()))
        r = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        return r if isinstance(r, httpx.Response) else reply(r)

    def sent(self, i: int = -1) -> str:
        return json.dumps(self.requests[i]["messages"])


@contextmanager
def hosted(model: FakeModel, **kw):
    """A client whose Nebius provider talks to `model` instead of the network."""
    import app.providers.nebius as nb

    real = httpx.AsyncClient
    nb.httpx.AsyncClient = lambda **k: real(transport=httpx.MockTransport(model), **k)
    try:
        app = create_app(make_settings(nebius_api_key="test-key-not-real", **kw))
        yield TestClient(app, raise_server_exceptions=False, headers={"X-Orbit-Token": TOKEN})
    finally:
        nb.httpx.AsyncClient = real


@pytest.fixture
def client():  # unconfigured provider
    return make_client()


@pytest.fixture
def demo():
    return make_client(demo_mode=True)


@pytest.fixture
def project(tmp_path):
    root = tmp_path / "work" / "proj"
    (root / "src").mkdir(parents=True)
    (root / "src" / "app.py").write_text("print('hi')\n")
    (root / "README.md").write_text("# Proj\n")
    (root / ".env").write_text("API_KEY=supersecretvalue123\n")
    (root / "notes.bin").write_bytes(b"\x00\x01")
    return root


@pytest.fixture
def auth_project(tmp_path):
    """A small backend with an authentication flow, for retrieval and agent tests."""
    root = tmp_path / "work" / "backend"
    (root / "app" / "auth").mkdir(parents=True)
    (root / "app" / "auth" / "login.py").write_text(
        "from app.auth.tokens import issue_token\n\n\ndef login(user, password):\n"
        "    # authentication: check the password hash, then issue a session token\n"
        "    if not verify_password(user, password):\n        raise PermissionError('bad credentials')\n"
        "    return issue_token(user)\n"
    )
    (root / "app" / "auth" / "tokens.py").write_text(
        'SIGNING_KEY = "Zq8xT3vN9pL2mK7wR4yB6cJ1hF5dS0aG"  # authentication token signing key\n\n\n'
        "def issue_token(user):\n    return sign(user.id, SIGNING_KEY)\n"
    )
    (root / "app" / "billing.py").write_text("def charge(invoice):\n    return invoice.total\n")
    (root / "README.md").write_text("# Backend\nLogin and billing service.\n")
    (root / "package.json").write_text('{"dependencies": {"express": "^4"}, "devDependencies": {"vitest": "^2"}}')
    (root / "pyproject.toml").write_text('[project]\nname = "x"\ndependencies = ["fastapi>=0.1", "pyjwt[crypto]==2.8"]\n')
    (root / ".env").write_text("JWT_SECRET=do-not-read-me-123456\n")
    return root
