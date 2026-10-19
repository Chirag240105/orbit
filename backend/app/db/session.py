from collections.abc import Iterator

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


def init_db(url: str, *, create_tables: bool = False) -> None:
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool
    engine = create_engine(url, **kwargs)
    from app import models  # noqa: F401  (register tables)

    if create_tables:
        Base.metadata.create_all(engine)
    _state["engine"], _state["maker"] = engine, sessionmaker(engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with _state["maker"]() as session:
        yield session
