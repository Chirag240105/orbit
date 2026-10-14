def test_health(client):
    j = client.get("/api/health").json()
    assert j["status"] == "ok" and j["provider"]["configured"] is False


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


def test_cors_rejects_unknown_origin(client):
    r = client.get("/api/health", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers
