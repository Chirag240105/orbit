from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import Engine, create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"
BASELINE_REVISION = "0001"  # the schema that older versions created with create_all()


class Base(DeclarativeBase):
    pass


_state: dict = {"engine": None, "maker": None}


def _alembic_config():
    from alembic.config import Config

    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS_DIR))
    return cfg


def run_migrations(engine: Engine) -> None:
    """Bring the database to the latest schema with Alembic. A database created by an older ORBIT
    (tables but no alembic_version) is stamped at the baseline first, then upgraded."""
    from alembic import command

    cfg = _alembic_config()
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        tables = set(inspect(conn).get_table_names())
        if "alembic_version" not in tables and "memories" in tables:
            command.stamp(cfg, BASELINE_REVISION)
        command.upgrade(cfg, "head")


def init_db(url: str) -> None:
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool
    engine = create_engine(url, **kwargs)
    from app import models  # noqa: F401  (register tables)

    run_migrations(engine)
    _state["engine"], _state["maker"] = engine, sessionmaker(engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with _state["maker"]() as session:
        yield session


def new_session() -> Session:
    """A session not tied to a request, for work that outlives the request handler (streaming)."""
    return _state["maker"]()
