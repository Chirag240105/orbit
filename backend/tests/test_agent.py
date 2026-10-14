"""Agent workflows: project notes (read -> analyze -> draft -> propose -> remember), AI drafts (AI-08),
component explanations (AI-09). Nothing is written without approval; consent comes before any send."""
import json

from tests.conftest import FakeModel, hosted

NOTES = json.dumps({
    "title": "Authentication flow",
    "summary": "Login checks the password, then issues a signed token.",
    "sections": [{"heading": "Login", "body": "`app/auth/login.py` verifies credentials."}, {"heading": "Tokens", "body": "`app/auth/tokens.py` signs tokens."}],
    "key_files": ["app/auth/login.py", "app/auth/tokens.py"],
    "open_questions": ["Where is verify_password defined?"],
    "memory": "The backend issues signed session tokens after password login.",
})
SECRET = "Zq8xT3vN9pL2mK7wR4yB6cJ1hF5dS0aG"


def _ws(c, root, write=False):
    ws = c.post("/api/workspaces", json={"path": str(root)}).json()["id"]
    if write:
        c.patch(f"/api/workspaces/{ws}", json={"allow_write": True})
    return ws


def test_project_notes_full_flow_in_demo(demo, auth_project):
    ws = _ws(demo, auth_project, write=True)
    r = demo.post(f"/api/workspaces/{ws}/agent/notes", json={"goal": "Explain the authentication flow", "file_paths": ["app/auth/login.py"], "notes_path": "docs/AUTH_NOTES.md"})
    assert r.status_code == 201, r.text
    run = r.json()
    assert [s["name"] for s in run["steps"]] == ["read", "analyze", "draft", "propose", "remember"]
    assert run["change"]["status"] == "pending" and run["change"]["origin"] == "ai" and run["change"]["original_content"] is None
    assert not (auth_project / "docs" / "AUTH_NOTES.md").exists()  # proposing never writes
    assert run["memory"]["confirmed"] is False and run["memory"]["type"] == "project" and run["memory"]["source"] == "agent"
    assert "`app/auth/login.py`" in run["markdown"] and run["provider"]["is_demo"] is True
    approved = demo.post(f"/api/changes/{run['change']['id']}/approve").json()
    assert approved["status"] == "applied"
    assert (auth_project / "docs" / "AUTH_NOTES.md").read_text(encoding="utf-8") == run["markdown"]
    assert demo.get(f"/api/conversations/{run['conversation_id']}/messages").json()[1]["skill"] == "project_notes"


def test_project_notes_with_hosted_model_needs_consent_and_redacts(auth_project):
    model = FakeModel(NOTES)
    with hosted(model) as c:
        ws = _ws(c, auth_project)
        body = {"goal": "Explain the authentication flow", "file_paths": ["app/auth/tokens.py", "app/auth/login.py"]}
        r = c.post(f"/api/workspaces/{ws}/agent/notes", json=body)
        assert r.status_code == 409 and r.json()["error"]["details"]["redactions"] == 1 and model.requests == []
        run = c.post(f"/api/workspaces/{ws}/agent/notes", json={**body, "consent_external": True}).json()
    sent = model.sent()
    assert SECRET not in sent and "do-not-read-me" not in sent and "workspace_layout" in sent
    assert run["markdown"].startswith("# Authentication flow") and "## Open questions" in run["markdown"]
    assert run["memory"]["content"].startswith("[backend] The backend issues")
    assert run["context"]["external"] is True and run["context"]["redactions"] == 1


def test_notes_path_must_be_markdown_inside_the_workspace(demo, auth_project):
    ws = _ws(demo, auth_project)
    url = f"/api/workspaces/{ws}/agent/notes"
    assert demo.post(url, json={"goal": "notes", "notes_path": "notes.py"}).json()["error"]["code"] == "invalid_path"
    assert demo.post(url, json={"goal": "notes", "notes_path": "../notes.md"}).json()["error"]["code"] == "path_not_allowed"
    assert demo.post(url, json={"goal": "notes", "notes_path": "my_secret_notes.md"}).json()["error"]["code"] == "path_excluded"


def test_agent_respects_a_disabled_skill(demo, auth_project):
    ws = _ws(demo, auth_project)
    demo.patch("/api/skills/project_notes", json={"enabled": False})
    assert demo.post(f"/api/workspaces/{ws}/agent/notes", json={"goal": "notes"}).status_code == 403


def test_agent_unconfigured_is_explicit(client, auth_project):
    ws = _ws(client, auth_project)
    assert client.post(f"/api/workspaces/{ws}/agent/notes", json={"goal": "notes"}).json()["error"]["code"] == "provider_not_configured"


# ---------- AI-08 drafts ----------
def test_draft_restores_secrets_and_only_proposes(auth_project):
    draft = ('<summary>Add a docstring</summary>\n<file>\n"""Token helpers."""\nSIGNING_KEY = "[REDACTED_1]"  # authentication token signing key\n\n\n'
             "def issue_token(user):\n    return sign(user.id, SIGNING_KEY)\n</file>")
    model = FakeModel(draft)
    with hosted(model) as c:
        ws = _ws(c, auth_project)
        body = {"path": "app/auth/tokens.py", "instruction": "Add a module docstring"}
        assert c.post(f"/api/workspaces/{ws}/draft", json=body).status_code == 409
        r = c.post(f"/api/workspaces/{ws}/draft", json={**body, "consent_external": True})
    assert r.status_code == 201, r.text
    change = r.json()["change"]
    assert SECRET not in model.sent() and "[REDACTED_1]" in model.sent()
    assert f'SIGNING_KEY = "{SECRET}"' in change["new_content"]  # the secret is put back locally
    assert change["origin"] == "ai" and change["description"] == "AI draft: Add a docstring" and change["status"] == "pending"
    assert not (auth_project / "app" / "auth" / "tokens.py").read_text().startswith('"""')


def test_draft_new_file_in_demo(demo, auth_project):
    ws = _ws(demo, auth_project)
    j = demo.post(f"/api/workspaces/{ws}/draft", json={"path": "docs/new.md", "instruction": "Write a contributing guide"}).json()
    assert j["change"]["original_content"] is None and "ORBIT demo draft" in j["change"]["new_content"]


def test_identical_or_unusable_draft_is_rejected(auth_project):
    same = (auth_project / "app" / "billing.py").read_text()
    with hosted(FakeModel(f"<summary>none</summary>\n<file>\n{same}</file>")) as c:
        ws = _ws(c, auth_project)
        r = c.post(f"/api/workspaces/{ws}/draft", json={"path": "app/billing.py", "instruction": "do nothing", "consent_external": True})
        assert r.status_code == 422 and r.json()["error"]["code"] == "no_change"
    with hosted(FakeModel("Sorry, I cannot do that.")) as c:
        ws = _ws(c, auth_project)
        r = c.post(f"/api/workspaces/{ws}/draft", json={"path": "app/billing.py", "instruction": "rewrite", "consent_external": True})
        assert r.json()["error"]["code"] == "draft_failed"


def test_draft_refuses_unsupported_or_excluded_targets(demo, auth_project):
    ws = _ws(demo, auth_project)
    assert demo.post(f"/api/workspaces/{ws}/draft", json={"path": ".env", "instruction": "add key"}).json()["error"]["code"] == "path_excluded"
    assert demo.post(f"/api/workspaces/{ws}/draft", json={"path": "run.sh", "instruction": "add a script"}).json()["error"]["code"] == "unsupported_file"


# ---------- AI-09 component explanations ----------
COMPONENT = {"scene": "Three-tier web app", "component": "Load balancer", "summary": "Spreads requests.", "details": "Curated details about load balancers."}


def test_component_explanation_falls_back_to_curated_text(demo, client):
    for c in (demo, client):
        j = c.post("/api/learn/explain", json=COMPONENT).json()
        assert j["ai_generated"] is False and j["explanation"] == COMPONENT["details"] and j["warnings"]


def test_component_explanation_is_labeled_ai_generated():
    model = FakeModel('{"explanation": "It spreads traffic.", "analogy": "A host seating guests.", "failure_impact": "Site goes down."}')
    with hosted(model) as c:
        j = c.post("/api/learn/explain", json=COMPONENT).json()
    assert j["ai_generated"] is True and j["analogy"].startswith("A host") and j["provider"]["name"] == "nebius"
    assert "curated_text" in model.sent() and "untrusted_data" in model.sent()


def test_draft_keeps_windows_line_endings(auth_project):
    (auth_project / "app" / "crlf.py").write_bytes(b"a = 1\r\nb = 2\r\n")
    with hosted(FakeModel("<summary>add c</summary>\n<file>\na = 1\nb = 2\nc = 3\n</file>")) as c:
        ws = _ws(c, auth_project)
        change = c.post(f"/api/workspaces/{ws}/draft", json={"path": "app/crlf.py", "instruction": "add c", "consent_external": True}).json()["change"]
    assert change["new_content"] == "a = 1\r\nb = 2\r\nc = 3\r\n"


def test_rerunning_the_agent_reuses_the_same_memory(demo, auth_project):
    ws = _ws(demo, auth_project)
    first = demo.post(f"/api/workspaces/{ws}/agent/notes", json={"goal": "notes"}).json()["memory"]
    demo.patch(f"/api/memories/{first['id']}", json={"confirmed": True})
    second = demo.post(f"/api/workspaces/{ws}/agent/notes", json={"goal": "notes"}).json()
    assert second["memory"]["id"] == first["id"] and second["memory"]["confirmed"] is True
    assert second["steps"][-1]["detail"] == "Already remembered this project fact."
    assert len(demo.get("/api/memories").json()) == 1
