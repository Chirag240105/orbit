def test_health(client):
    j = client.get("/api/health").json()
    assert j["status"] == "ok" and j["provider"]["configured"] is False
    assert j["provider"]["name"] == "nebius"
    assert j["provider"]["reachability"]["reachable"] is False


def test_chat_unconfigured_is_explicit(client):
    r = client.post("/api/chat", json={"message": "hi"})
    assert r.status_code == 503 and r.json()["error"]["code"] == "provider_not_configured"


def test_chat_demo_is_labeled(demo):
    j = demo.post("/api/chat", json={"message": "What is FastAPI?"}).json()
    assert j["provider"]["is_demo"] is True and j["warnings"] and j["skill"] == "general_qa"
    assert demo.get(f"/api/conversations/{j['conversation_id']}/messages").json()[1]["role"] == "assistant"


def test_chat_validation_error_is_generic(demo):
    r = demo.post("/api/chat", json={"message": ""})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


def test_plan_proposes_tasks(demo):
    j = demo.post("/api/chat", json={"message": "plan my week"}).json()
    assert j["skill"] == "task_plan" and j["proposed_tasks"]


def test_memory_crud_and_retrieval(demo):
    m = demo.post("/api/memories", json={"content": "I deploy with Docker on Hetzner"}).json()
    assert demo.get("/api/memories", params={"q": "docker"}).json()[0]["id"] == m["id"]
    assert demo.patch(f"/api/memories/{m['id']}", json={"content": "I deploy with Fly.io"}).json()["content"].startswith("I deploy with Fly")
    ctx = demo.post("/api/chat", json={"message": "How do I deploy with Fly.io?"}).json()["context"]
    assert ctx["memory_ids"] == [m["id"]]
    assert demo.delete(f"/api/memories/{m['id']}").status_code == 204
    assert demo.get("/api/memories").json() == []


def test_memory_deduplicates_same_type_and_updates_user_entry(demo):
    async def similar_embedding(_texts):
        return [[1.0, 0.0]]
    demo.app.state.model_gateway.embed = similar_embedding
    first = demo.post("/api/memories", json={"content": "I use PostgreSQL for ORBIT", "type": "PROJECT"}).json()
    second = demo.post("/api/memories", json={"content": "ORBIT uses PostgreSQL", "type": "PROJECT"}).json()
    assert second["id"] == first["id"]
    assert second["content"] == "ORBIT uses PostgreSQL"
    assert len(demo.get("/api/memories").json()) == 1


def test_unconfirmed_suggestion_not_retrieved(demo):
    demo.post("/api/memories", json={"content": "likes pineapple pizza", "source": "chat_suggestion"})
    assert demo.post("/api/chat", json={"message": "pineapple pizza?"}).json()["context"]["memory_ids"] == []


def test_delete_all_history(demo):
    demo.post("/api/chat", json={"message": "hello"})
    assert demo.delete("/api/conversations").status_code == 204
    assert demo.get("/api/conversations").json() == []


def test_tasks_flow(client):
    t = client.post("/api/tasks", json={"title": "Ship", "status": "proposed", "source": "plan"}).json()
    assert client.patch(f"/api/tasks/{t['id']}", json={"status": "todo"}).json()["status"] == "todo"
    assert client.delete(f"/api/tasks/{t['id']}").status_code == 204


def test_projects_and_notes_crud(client):
    project = client.post("/api/projects", json={"name": "ORBIT", "description": "Personal AI"})
    assert project.status_code == 201
    project = project.json()
    note = client.post("/api/notes", json={
        "title": "Decision", "content": "Use PostgreSQL", "project_id": project["id"],
    })
    assert note.status_code == 201
    note = note.json()
    assert client.get("/api/projects").json()[0]["id"] == project["id"]
    assert client.get("/api/notes", params={"project_id": project["id"]}).json()[0]["id"] == note["id"]
    assert client.patch(f"/api/projects/{project['id']}", json={"description": "Updated"}).json()["description"] == "Updated"
    assert client.patch(f"/api/notes/{note['id']}", json={"content": "Revised"}).json()["content"] == "Revised"
    assert client.delete(f"/api/projects/{project['id']}").status_code == 204
    assert client.get("/api/notes").json()[0]["project_id"] is None
    assert client.delete(f"/api/notes/{note['id']}").status_code == 204


def test_project_and_note_require_owned_project(client):
    response = client.post("/api/notes", json={"title": "Orphan", "project_id": 999})
    assert response.status_code == 404


def test_cors_rejects_unknown_origin(client):
    r = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers


def test_cors_allows_authorization_header_from_configured_origin(client):
    r = client.options("/api/tasks", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    })
    assert r.status_code == 200
    assert "authorization" in r.headers["access-control-allow-headers"].lower()
def test_explicit_vision_context_is_saved_as_project_linked_memory(demo):
    result = demo.post("/api/vision/context", json={
        "content": "The API gateway receives frontend requests.",
        "project_name": "Cloud app architecture",
    })
    assert result.status_code == 201
    memory = result.json()
    assert memory["type"] == "VISION" and memory["confirmed"] is True
    assert memory["project_id"] is not None
