import pathlib

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from app.config import Settings
from app.db.session import Base
from app.main import create_app
from app.models import Memory

ALEMBIC_INI = str(pathlib.Path(__file__).resolve().parents[1] / "alembic.ini")
MIGRATIONS_DIR = str(pathlib.Path(__file__).resolve().parents[1] / "migrations")


def _get_alembic_config() -> Config:
    config = Config(ALEMBIC_INI)
    config.set_main_option("script_location", MIGRATIONS_DIR)
    return config


def test_initial_migration_creates_prd_tables(tmp_path, monkeypatch):
    database = tmp_path / "fresh.db"
    monkeypatch.setenv("ORBIT_DATABASE_URL", f"sqlite:///{database.as_posix()}")
    config = _get_alembic_config()

    command.upgrade(config, "head")
    command.upgrade(config, "head")

    engine = create_engine(f"sqlite:///{database.as_posix()}")
    tables = set(inspect(engine).get_table_names())
    assert {"users", "projects", "tasks", "schedule_blocks", "memories", "conversations", "notes", "pending_actions", "tool_permissions", "audit_log"} <= tables
    memory_columns = {column["name"] for column in inspect(engine).get_columns("memories")}
    assert {"user_id", "embedding", "importance", "last_accessed", "project_id"} <= memory_columns
    engine.dispose()


def test_memory_vector_column_compiles_to_pgvector():
    ddl = str(CreateTable(Memory.__table__).compile(dialect=postgresql.dialect()))
    assert "embedding VECTOR" in ddl


def test_memory_persists_after_app_restart(tmp_path, monkeypatch):
    database = tmp_path / "restart.db"
    url = f"sqlite:///{database.as_posix()}"
    monkeypatch.setenv("ORBIT_DATABASE_URL", url)
    config = _get_alembic_config()
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


def test_app_startup_migrates_empty_database_and_memory_schedule_routes_work(tmp_path):
    database = tmp_path / "empty.db"
    url = f"sqlite:///{database.as_posix()}"
    settings = Settings(database_url=url, jwt_secret="migration-test-secret", llm_provider="demo", _env_file=None)

    client = TestClient(create_app(settings), raise_server_exceptions=False)
    assert client.get("/health").status_code == 200
    registered = client.post("/api/auth/register", json={"email": "fresh@example.com", "password": "test-password-123"})
    assert registered.status_code == 200
    client.headers["Authorization"] = f"Bearer {registered.json()['access_token']}"

    assert client.get("/api/health").status_code == 200
    created = client.post("/api/memories", json={"content": "fresh migration memory", "type": "USER"})
    assert created.status_code == 201
    assert created.json()["project_id"] is None
    listed = client.get("/api/memories")
    assert listed.status_code == 200
    assert [memory["content"] for memory in listed.json()] == ["fresh migration memory"]
    assert client.get("/api/memory").status_code == 200
    schedule = client.get("/api/schedule?date=today")
    assert schedule.status_code == 200
    assert schedule.json() == []

    engine = create_engine(url)
    assert "schedule_blocks" in inspect(engine).get_table_names()
    assert "project_id" in {column["name"] for column in inspect(engine).get_columns("memories")}
    with engine.connect() as connection:
        differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
    assert differences == []
    engine.dispose()
