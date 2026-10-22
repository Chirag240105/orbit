from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def client():
    app = create_app(Settings(database_url="sqlite://", jwt_secret="test-secret", llm_provider="demo", _env_file=None))
    return TestClient(app, raise_server_exceptions=False)


def test_data_routes_require_bearer_token():
    c = client()
    response = c.get("/api/memories")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "authentication_required"


def test_register_login_and_user_data_isolation():
    c = client()
    a = c.post("/api/auth/register", json={"email": "a@example.com", "password": "correct-horse-1"})
    b = c.post("/api/auth/register", json={"email": "b@example.com", "password": "correct-horse-2"})
    assert a.status_code == b.status_code == 200
    token_a, token_b = a.json()["access_token"], b.json()["access_token"]

    c.headers["Authorization"] = f"Bearer {token_a}"
    created = c.post("/api/memories", json={"content": "Only account A can see this"}).json()
    c.headers["Authorization"] = f"Bearer {token_b}"
    assert c.get("/api/memories").json() == []
    assert c.patch(f"/api/memories/{created['id']}", json={"content": "takeover"}).status_code == 404

    login = c.post("/api/auth/login", json={"email": "a@example.com", "password": "correct-horse-1"})
    assert login.status_code == 200
    assert c.post("/api/auth/login", json={"email": "a@example.com", "password": "wrong-password"}).status_code == 401


def test_user_owned_resources_and_pending_actions_are_isolated():
    c = client()
    account_a = c.post("/api/auth/register", json={"email": "owner@example.com", "password": "owner-password-123"}).json()
    account_b = c.post("/api/auth/register", json={"email": "reader@example.com", "password": "reader-password-123"}).json()

    c.headers["Authorization"] = f"Bearer {account_a['access_token']}"
    project = c.post("/api/projects", json={"name": "Private project"}).json()
    note = c.post("/api/notes", json={"title": "Private note", "project_id": project["id"]}).json()
    memory = c.post("/api/memories", json={"content": "Private decision"}).json()
    task = c.post("/api/tasks", json={"title": "Private task"}).json()
    pending = c.post("/api/tools/create_task/invoke", json={"title": "Approve only as owner"}).json()
    schedule = c.post("/api/schedule/generate", json={
        "request": "Attend the design review",
        "date": "2026-10-22",
        "fixed_events": [{
            "title": "Design review",
            "starts_at": "2026-10-22T11:00:00+05:30",
            "ends_at": "2026-10-22T12:00:00+05:30",
        }],
    })
    assert schedule.status_code == 200
    schedule_action = schedule.json()["pending_action_id"]
    assert c.post(f"/api/actions/{schedule_action}/approve").status_code == 200

    c.headers["Authorization"] = f"Bearer {account_b['access_token']}"
    assert c.get("/api/projects").json() == []
    assert c.get("/api/notes").json() == []
    assert c.get("/api/memories").json() == []
    assert c.get("/api/tasks").json() == []
    assert c.get("/api/actions").json() == []
    assert c.get("/api/schedule", params={"day": "2026-10-22"}).json() == []
    assert c.patch(f"/api/projects/{project['id']}", json={"name": "stolen"}).status_code == 404
    assert c.delete(f"/api/notes/{note['id']}").status_code == 404
    assert c.patch(f"/api/memories/{memory['id']}", json={"content": "stolen"}).status_code == 404
    assert c.delete(f"/api/tasks/{task['id']}").status_code == 404
    assert c.post(f"/api/actions/{pending['pending_action_id']}/approve").status_code == 404
    assert c.post(f"/api/actions/{schedule_action}/approve").status_code == 404


def test_duplicate_email_and_bad_token_are_rejected():
    c = client()
    c.post("/api/auth/register", json={"email": "repeat@example.com", "password": "test-password-123"})
    duplicate = c.post("/api/auth/register", json={"email": "repeat@example.com", "password": "test-password-123"})
    assert duplicate.status_code == 409
    c.headers["Authorization"] = "Bearer not.a.valid.token"
    assert c.get("/api/tasks").status_code == 401


def test_authentication_endpoints_are_rate_limited():
    c = client()
    body = {"email": "limited@example.com", "password": "test-password-123"}
    statuses = [c.post("/api/auth/register", json=body).status_code for _ in range(11)]
    assert statuses[:10] == [200] + [409] * 9
    assert statuses[10] == 429
