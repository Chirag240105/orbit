"""Alembic environment. The app runs `upgrade head` on startup (app/db/session.py: run_migrations), so manual
commands are only needed to inspect or create revisions:
    alembic upgrade head          # uses ORBIT_DATABASE_URL, like the app
    alembic revision --autogenerate -m "add x"   # then review the generated file
"""
from alembic import context
from sqlalchemy import create_engine

from app import models  # noqa: F401  (register tables)
from app.db.session import Base

config = context.config
target_metadata = Base.metadata


def _run(connection) -> None:
    # render_as_batch: SQLite cannot ALTER most things in place; batch mode copies the table instead.
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:  # called from the app with an open connection
        _run(connection)
        return
    url = context.get_x_argument(as_dictionary=True).get("url")
    if not url:
        from app.config import Settings

        url = Settings().database_url
    with create_engine(url).begin() as conn:
        _run(conn)


run_migrations_online()
