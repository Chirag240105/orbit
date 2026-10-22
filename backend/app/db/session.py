from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker, with_loader_criteria
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


_state: dict = {"engine": None, "maker": None}


@event.listens_for(Session, "do_orm_execute")
def _scope_reads(execute_state) -> None:
    user_id = execute_state.session.info.get("user_id")
    if user_id is not None:
        from app.models import Owned

        execute_state.statement = execute_state.statement.options(
            with_loader_criteria(Owned, lambda cls: cls.user_id == user_id, include_aliases=True)
        )


@event.listens_for(Session, "before_flush")
def _assign_owner(session: Session, _flush_context, _instances) -> None:
    from app.models import Owned

    user_id = session.info.get("user_id")
    for instance in session.new:
        if isinstance(instance, Owned):
            if instance.user_id is None and user_id is not None:
                instance.user_id = user_id
            if instance.user_id is None:
                raise RuntimeError("User-owned records require an authenticated session.")
            if user_id is not None and instance.user_id != user_id:
                raise RuntimeError("Cannot create a record for a different user.")


def init_db(url: str, *, create_tables: bool = False, auto_migrate: bool = True) -> None:
    """Configure the session factory after bringing the database to Alembic head.

    ``create_tables`` remains accepted for older callers, but intentionally does
    not call ``metadata.create_all``. Schema changes must go through revisions.
    """
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool
    engine = create_engine(url, **kwargs)
    from alembic import command
    from alembic.config import Config
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory

    from app import models  # noqa: F401  (register tables)

    backend_dir = Path(__file__).resolve().parents[2]
    alembic_config = Config(str(backend_dir / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(backend_dir / "migrations"))
    alembic_config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    try:
        with engine.begin() as connection:
            if auto_migrate:
                alembic_config.attributes["connection"] = connection
                command.upgrade(alembic_config, "head")
            scripts = ScriptDirectory.from_config(alembic_config)
            expected = scripts.get_current_head()
            actual = MigrationContext.configure(connection).get_current_revision()
            if actual != expected:
                raise RuntimeError(
                    f"Database schema is at Alembic revision {actual!r}; expected {expected!r}. "
                    "Run `python -m app.db.migrate` from backend to upgrade it."
                )
    except Exception as exc:
        engine.dispose()
        if isinstance(exc, RuntimeError) and "Database schema is at Alembic revision" in str(exc):
            raise
        raise RuntimeError(
            "Could not migrate the ORBIT database. If this is a local SQLite database "
            "created before Alembic was enabled, back it up and run "
            "`python scripts/reset_dev_db.py` from the repository root. "
            f"Migration error: {exc}"
        ) from exc
    _state["engine"], _state["maker"] = engine, sessionmaker(engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with _state["maker"]() as session:
        yield session
