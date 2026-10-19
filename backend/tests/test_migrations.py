from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

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
    assert {"user_id", "embedding"} <= memory_columns
    engine.dispose()


def test_memory_vector_column_compiles_to_pgvector():
    ddl = str(CreateTable(Memory.__table__).compile(dialect=postgresql.dialect()))
    assert "embedding VECTOR" in ddl
