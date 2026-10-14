from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


_state: dict = {"engine": None, "maker": None}


def init_db(url: str) -> None:
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool
    engine = create_engine(url, **kwargs)
    from app import models  # noqa: F401  (register tables)

    Base.metadata.create_all(engine)
    _state["engine"], _state["maker"] = engine, sessionmaker(engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with _state["maker"]() as session:
        yield session
