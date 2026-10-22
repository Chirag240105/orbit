import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def make_client(**kw) -> TestClient:
    settings = Settings(database_url="sqlite://", _env_file=None, **kw)
    client = TestClient(create_app(settings), raise_server_exceptions=False)
    result = client.post("/api/auth/register", json={"email": "test@example.com", "password": "test-password-123"})
    client.headers["Authorization"] = f"Bearer {result.json()['access_token']}"
    return client


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
