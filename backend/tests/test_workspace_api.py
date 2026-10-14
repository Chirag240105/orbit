def add(client, project):
    r = client.post("/api/workspaces", json={"path": str(project)})
    assert r.status_code == 201, r.text
    return r.json()


def test_tree_hides_sensitive_and_unsupported(demo, project):
    ws = add(demo, project)
    paths = {f["path"] for f in demo.get(f"/api/workspaces/{ws['id']}/tree").json()}
    assert paths == {"src/app.py", "README.md"}


def test_read_and_refusals(demo, project):
    ws = add(demo, project)
    base = f"/api/workspaces/{ws['id']}/file"
    assert "print" in demo.get(base, params={"path": "src/app.py"}).json()["content"]
    assert demo.get(base, params={"path": ".env"}).json()["error"]["code"] == "path_excluded"
    assert demo.get(base, params={"path": "../x"}).json()["error"]["code"] == "path_not_allowed"
    assert demo.get(base, params={"path": "notes.bin"}).json()["error"]["code"] == "unsupported_file"


def test_search_never_returns_env(demo, project):
    ws = add(demo, project)
    hits = demo.get(f"/api/workspaces/{ws['id']}/search", params={"q": "supersecret"}).json()
    assert hits == []


def test_summary_and_duplicate(demo, project):
    ws = add(demo, project)
    assert demo.get(f"/api/workspaces/{ws['id']}/summary").json()["file_count"] == 2
    assert demo.post("/api/workspaces", json={"path": str(project)}).json()["error"]["code"] == "duplicate"


def test_write_requires_approval_and_permission(demo, project):
    ws = add(demo, project)
    c = demo.post(f"/api/workspaces/{ws['id']}/changes", json={"path": "README.md", "new_content": "# New\n"}).json()
    assert c["status"] == "pending" and (project / "README.md").read_text() == "# Proj\n"  # proposing never writes
    r = demo.post(f"/api/changes/{c['id']}/approve")
    assert r.status_code == 403 and r.json()["error"]["code"] == "permission_denied"
    assert (project / "README.md").read_text() == "# Proj\n"
    demo.patch(f"/api/workspaces/{ws['id']}", json={"allow_write": True})
    assert demo.post(f"/api/changes/{c['id']}/approve").json()["status"] == "applied"
    assert (project / "README.md").read_text() == "# New\n"


def test_cannot_propose_write_to_secret_or_outside(demo, project):
    ws = add(demo, project)
    url = f"/api/workspaces/{ws['id']}/changes"
    assert demo.post(url, json={"path": ".env", "new_content": "x"}).json()["error"]["code"] == "path_excluded"
    assert demo.post(url, json={"path": "../evil.py", "new_content": "x"}).json()["error"]["code"] == "path_not_allowed"


def test_stale_change_detected(demo, project):
    ws = add(demo, project)
    demo.patch(f"/api/workspaces/{ws['id']}", json={"allow_write": True})
    c = demo.post(f"/api/workspaces/{ws['id']}/changes", json={"path": "README.md", "new_content": "# X\n"}).json()
    (project / "README.md").write_text("changed elsewhere")
    assert demo.post(f"/api/changes/{c['id']}/approve").json()["error"]["code"] == "stale_change"


def test_chat_with_file_needs_workspace(demo):
    r = demo.post("/api/chat", json={"message": "explain", "file_paths": ["a.py"]})
    assert r.status_code == 403


def test_explain_without_file_asks_clarifying_question(demo, project):
    ws = add(demo, project)
    j = demo.post("/api/chat", json={"message": "explain this", "skill": "explain_code", "workspace_id": ws["id"]}).json()
    assert "clarifying_question" in j["output"]


def test_explain_file_in_demo_sends_nothing_external(demo, project):
    ws = add(demo, project)
    j = demo.post("/api/chat", json={"message": "explain", "skill": "explain_code", "workspace_id": ws["id"], "file_paths": ["src/app.py"]}).json()
    assert j["context"]["external"] is False and j["context"]["files"] == ["src/app.py"]
