"""Upgrade the configured database to the latest Alembic revision."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine

from app.config import Settings


def upgrade_database(database_url: str | None = None) -> str:
    url = database_url or Settings().database_url
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    backend_dir = Path(__file__).resolve().parents[2]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "migrations"))
    config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    engine = create_engine(url, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {})
    try:
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
            actual = MigrationContext.configure(connection).get_current_revision()
            expected = ScriptDirectory.from_config(config).get_current_head()
            if actual != expected:
                raise RuntimeError(f"Database schema is at {actual!r}; expected {expected!r}.")
            return expected
    except Exception as exc:
        raise RuntimeError(
            "Database migration failed. If this SQLite file predates Alembic, "
            "back it up and run `python scripts/reset_dev_db.py` from the repository root. "
            f"Migration error: {exc}"
        ) from exc
    finally:
        engine.dispose()


def main() -> None:
    revision = upgrade_database()
    print(f"Database is at Alembic revision {revision}.")


if __name__ == "__main__":
    main()
