from types import SimpleNamespace

from tests.conftest import make_client


def test_code_explain_respects_workspace_exclusions(demo, project):
    added = demo.post("/api/workspaces", json={"path": str(project)})
    assert added.status_code == 201
    workspace_id = added.json()["id"]
    result = demo.post("/api/code/explain", json={"mode": "file", "workspace_id": workspace_id, "path": ".env"})
    assert result.status_code == 403
    assert "supersecretvalue123" not in result.text


def test_code_explain_requires_consent_and_redacts_before_hosted_send(monkeypatch, project):
    client = make_client(llm_provider="nebius", nebius_api_key="unit-test-key", model_planner="unit-test-model")
    added = client.post("/api/workspaces", json={"path": str(project)})
    workspace_id = added.json()["id"]
    body = {"mode": "file", "workspace_id": workspace_id, "path": "src/app.py"}
    denied = client.post("/api/code/explain", json=body)
    assert denied.status_code == 409 and denied.json()["error"]["code"] == "consent_required"

    seen = []

    async def fake_complete(messages, task="planner"):
        seen.append("\n".join(message["content"] for message in messages))
        return SimpleNamespace(text='{"summary":"Explains the file.","files":[{"path":"src/app.py","summary":"Defines app"}],"flow_steps":[],"risks":[],"dependencies":[],"unknowns":[]}')

    monkeypatch.setattr(client.app.state.model_gateway, "complete", fake_complete)
    project_file = project / "src" / "app.py"
    project_file.write_text("API_KEY=sk-abcdefghijklmnopqrstuv\nprint('ok')\n", encoding="utf-8")
    result = client.post("/api/code/explain", json={**body, "consent_external": True})
    assert result.status_code == 200
    assert result.json()["redactions"] == 2 and result.json()["external"] is True
    assert "[REDACTED]" in seen[0] and "sk-abcdefghijklmnopqrstuv" not in seen[0]


def test_code_explain_demo_selection_has_structured_response(demo):
    result = demo.post("/api/code/explain", json={"mode": "selection", "selection": "def login(): return True"})
    assert result.status_code == 200
    assert result.json()["mode"] == "selection"
    assert result.json()["files"][0]["path"] == "selection"
    assert result.json()["external"] is False


def test_project_explanation_map_reduce_stores_unconfirmed_project_memory(monkeypatch, project):
    client = make_client(llm_provider="nebius", nebius_api_key="unit-test-key", model_planner="unit-test-model")
    workspace_id = client.post("/api/workspaces", json={"path": str(project)}).json()["id"]
    calls = []

    async def fake_complete(messages, task="planner"):
        calls.append(task)
        if len(calls) <= 2:
            text = '{"summary":"Source chunk summary","flow_steps":[],"risks":[],"dependencies":[],"unknowns":[]}'
        else:
            text = '{"summary":"Project uses a small Python app.","files":[{"path":"src/app.py","summary":"Entry point."}],"flow_steps":[],"risks":[],"dependencies":["FastAPI"],"unknowns":[]}'
        return SimpleNamespace(text=text)

    async def fake_embed(texts):
        return [[0.01] * client.app.state.settings.embedding_dimension for _ in texts]

    monkeypatch.setattr(client.app.state.model_gateway, "complete", fake_complete)
    monkeypatch.setattr(client.app.state.model_gateway, "embed", fake_embed)
    result = client.post("/api/code/explain", json={
        "mode": "project", "workspace_id": workspace_id, "consent_external": True,
    })
    assert result.status_code == 200 and len(calls) == 3
    assert result.json()["stored_memory_id"] is not None
    memories = client.get("/api/memories").json()
    assert any(memory["type"] == "PROJECT" and not memory["confirmed"] for memory in memories)
