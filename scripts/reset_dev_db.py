"""Remove and recreate the configured local SQLite dev database, then seed it."""

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402

from app.config import Settings  # noqa: E402
from app.db.migrate import upgrade_database  # noqa: E402
from app.main import create_app  # noqa: E402


def _database_file(database_url: str) -> Path:
    url = make_url(database_url)
    if not url.drivername.startswith("sqlite") or not url.database or url.database == ":memory:":
        raise ValueError("Refusing reset: ORBIT_DATABASE_URL must point to a local SQLite file.")
    candidate = Path(url.database)
    if not candidate.is_absolute():
        candidate = BACKEND / candidate
    candidate = candidate.resolve()
    if not candidate.is_relative_to(BACKEND.resolve()):
        raise ValueError("Refusing reset: the SQLite database file must be inside backend/.")
    return candidate


def _seed(database_url: str, email: str, password: str) -> None:
    settings = Settings(
        database_url=database_url,
        llm_provider="demo",
        demo_mode=True,
        _env_file=None,
    )
    with TestClient(create_app(settings), raise_server_exceptions=False) as client:
        response = client.post("/api/auth/register", json={"email": email, "password": password})
        if response.status_code != 200:
            raise RuntimeError(f"Could not create demo account (HTTP {response.status_code}).")
        client.headers["Authorization"] = f"Bearer {response.json()['access_token']}"

        project = client.post(
            "/api/projects",
            json={"name": "ORBIT demo project", "description": "A personal AI workspace for planning and learning."},
        )
        if project.status_code >= 400:
            raise RuntimeError(f"Could not seed demo project (HTTP {project.status_code}).")
        project_id = project.json()["id"]

        memories = [
            ("Build a thoughtful personal AI workspace for planning and learning.", "PROJECT"),
            ("Show a short plan before proposing actions that change data.", "PREFERENCE"),
            ("Keep camera hand tracking in the browser; never upload camera frames.", "DECISION"),
        ]
        for content, kind in memories:
            saved = client.post(
                "/api/memories",
                json={"content": content, "type": kind, "project_id": project_id},
            )
            if saved.status_code >= 400:
                raise RuntimeError(f"Could not seed demo memory (HTTP {saved.status_code}).")

        tasks = [
            ("Review the weekly learning plan", "Compare planned study blocks with completed work.", "medium"),
            ("Draft the next project milestone", "Write a short implementation plan for the demo workspace.", "high"),
        ]
        for title, notes, priority in tasks:
            saved = client.post("/api/tasks", json={"title": title, "notes": notes, "priority": priority})
            if saved.status_code >= 400:
                raise RuntimeError(f"Could not seed demo task (HTTP {saved.status_code}).")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--yes", action="store_true", help="confirm permanent deletion of the SQLite dev DB")
    args = parser.parse_args()
    database_url = Settings().database_url
    email, password = os.environ.get("ORBIT_DEMO_EMAIL"), os.environ.get("ORBIT_DEMO_PASSWORD")
    if not email or not password or len(password) < 12:
        parser.error("set ORBIT_DEMO_EMAIL and ORBIT_DEMO_PASSWORD (at least 12 characters) before resetting")
    try:
        database = _database_file(database_url)
    except ValueError as exc:
        parser.error(str(exc))
    # Make the URL independent of whether this command is run from the repo
    # root or backend/; SQLAlchemy resolves relative SQLite URLs from cwd.
    database_url = f"sqlite:///{database.as_posix()}"
    if not args.yes:
        answer = input(f"Delete {database} and rebuild it with demo data? [y/N] ").strip().lower()
        if answer not in {"y", "yes"}:
            print("Reset cancelled.")
            return 1

    database.parent.mkdir(parents=True, exist_ok=True)
    for candidate in (database, Path(f"{database}-wal"), Path(f"{database}-shm")):
        candidate.unlink(missing_ok=True)
    upgrade_database(database_url)
    _seed(database_url, email, password)
    print(f"Reset and seeded the local SQLite database at {database}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
