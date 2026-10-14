"""BE-01: the schema comes from Alembic revisions, not create_all()."""
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text

from app.db.session import Base, _alembic_config, init_db


def _url(tmp_path, name="orbit.db") -> str:
    return f"sqlite:///{(tmp_path / name).as_posix()}"


def test_fresh_database_matches_the_models(tmp_path):
    url = _url(tmp_path)
    init_db(url)
    with create_engine(url).connect() as conn:
        assert compare_metadata(MigrationContext.configure(conn), Base.metadata) == []
        assert conn.execute(text("select version_num from alembic_version")).scalar() == "0002"


def test_legacy_database_is_stamped_and_upgraded_keeping_data(tmp_path):
    """A database made by ORBIT 0.1 (create_all, no alembic_version) gains the 0002 column."""
    url = _url(tmp_path)
    engine = create_engine(url)
    cfg = _alembic_config()
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, "0001")
        conn.execute(text("drop table alembic_version"))
        conn.execute(text("insert into workspaces (id, name, path, allow_write, created_at) values (1, 'w', '/w', 0, '2026-01-01')"))
        conn.execute(text("insert into proposed_changes (workspace_id, rel_path, description, new_content, status, created_at) values (1, 'a.md', '', 'x', 'pending', '2026-01-01')"))
    init_db(url)
    with create_engine(url).connect() as conn:
        assert "origin" in {c["name"] for c in inspect(conn).get_columns("proposed_changes")}
        assert conn.execute(text("select origin, new_content from proposed_changes")).one() == ("user", "x")


def test_cli_upgrade_and_downgrade_use_the_app_database_url(tmp_path, monkeypatch):
    url = _url(tmp_path, "cli.db")
    monkeypatch.setenv("ORBIT_DATABASE_URL", url)
    cfg = _alembic_config()
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    with create_engine(url).connect() as conn:
        assert set(inspect(conn).get_table_names()) == {"alembic_version"}
    command.upgrade(cfg, "head")
    with create_engine(url).connect() as conn:
        assert "memories" in inspect(conn).get_table_names()


def test_api_suite_runs_on_a_migrated_file_database(tmp_path):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from tests.conftest import TOKEN, make_settings

    settings = make_settings(demo_mode=True)
    settings.database_url = _url(tmp_path, "api.db")
    c = TestClient(create_app(settings), headers={"X-Orbit-Token": TOKEN})
    assert c.post("/api/memories", json={"content": "I like tea"}).status_code == 201
    assert c.post("/api/chat", json={"message": "hello"}).status_code == 200
