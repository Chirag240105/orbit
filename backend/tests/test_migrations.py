from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from app.config import Settings
from app.main import create_app
from app.models import Memory


def test_initial_migration_creates_prd_tables(tmp_path, monkeypatch):
    database = tmp_path / "fresh.db"
    monkeypatch.setenv("ORBIT_DATABASE_URL", f"sqlite:///{database.as_posix()}")
    config = Config("alembic.ini")

    command.upgrade(config, "head")
    command.upgrade(config, "head")

    engine = create_engine(f"sqlite:///{database.as_posix()}")
    tables = set(inspect(engine).get_table_names())
    assert {"users", "projects", "tasks", "schedule_blocks", "memories", "conversations", "notes", "pending_actions", "tool_permissions", "audit_log"} <= tables
    memory_columns = {column["name"] for column in inspect(engine).get_columns("memories")}
    assert {"user_id", "embedding", "importance", "last_accessed"} <= memory_columns
    engine.dispose()


def test_memory_vector_column_compiles_to_pgvector():
    ddl = str(CreateTable(Memory.__table__).compile(dialect=postgresql.dialect()))
    assert "embedding VECTOR" in ddl


def test_memory_persists_after_app_restart(tmp_path, monkeypatch):
    database = tmp_path / "restart.db"
    url = f"sqlite:///{database.as_posix()}"
    monkeypatch.setenv("ORBIT_DATABASE_URL", url)
    config = Config("alembic.ini")
    command.upgrade(config, "head")
    settings = Settings(database_url=url, jwt_secret="stable-test-secret", llm_provider="demo", _env_file=None)

    first = TestClient(create_app(settings), raise_server_exceptions=False)
    registered = first.post("/api/auth/register", json={"email": "persistent@example.com", "password": "test-password-123"}).json()
    first.headers["Authorization"] = f"Bearer {registered['access_token']}"
    saved = first.post("/api/memories", json={"content": "I use PostgreSQL", "type": "PREFERENCE"})
    assert saved.status_code == 201

    second = TestClient(create_app(settings), raise_server_exceptions=False)
    login = second.post("/api/auth/login", json={"email": "persistent@example.com", "password": "test-password-123"}).json()
    second.headers["Authorization"] = f"Bearer {login['access_token']}"
    memories = second.get("/api/memories").json()
    assert [memory["content"] for memory in memories] == ["I use PostgreSQL"]
    assert memories[0]["importance"] == 1.0
