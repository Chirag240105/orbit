"""BE-03: ranked file suggestions are local, explain themselves, and never include excluded files."""
from app.workspace.service import rank_files, summarize


def test_auth_question_ranks_auth_files_first(auth_project):
    ranked = rank_files(str(auth_project), "identify the authentication flow", 200_000)
    assert {r["path"] for r in ranked[:2]} == {"app/auth/login.py", "app/auth/tokens.py"}
    assert all(r["reasons"] for r in ranked)
    assert "app/billing.py" not in [r["path"] for r in ranked]


def test_identifier_parts_match(auth_project):
    top = rank_files(str(auth_project), "where is issueToken defined", 200_000)[0]
    assert top["path"] == "app/auth/tokens.py"


def test_excluded_files_are_never_suggested(auth_project):
    assert all(r["path"] != ".env" for r in rank_files(str(auth_project), "JWT_SECRET secret jwt", 200_000))


def test_question_without_terms_returns_nothing(auth_project):
    assert rank_files(str(auth_project), "the and for", 200_000) == []


def test_summary_lists_dependencies_from_manifests(auth_project):
    deps = summarize(str(auth_project))["dependencies"]
    assert deps == {"package.json": ["express", "vitest"], "pyproject.toml": ["fastapi", "pyjwt"]}


def test_malformed_manifest_is_ignored(auth_project):
    (auth_project / "package.json").write_text("{not json")
    assert "package.json" not in summarize(str(auth_project))["dependencies"]


def test_suggest_endpoint(demo, auth_project):
    ws = demo.post("/api/workspaces", json={"path": str(auth_project)}).json()["id"]
    hits = demo.get(f"/api/workspaces/{ws}/suggest", params={"q": "how does login work"}).json()
    assert hits[0]["path"] == "app/auth/login.py" and isinstance(hits[0]["score"], float)
