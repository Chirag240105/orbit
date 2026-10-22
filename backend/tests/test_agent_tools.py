from app.tools.agent_registry import AnalyzeCodeArgs


def test_write_tool_waits_for_approval_and_reject_creates_nothing(demo):
    pending = demo.post("/api/tools/create_task/invoke", json={"title": "Rejected task", "priority": "high"}).json()
    assert pending["status"] == "pending"
    assert demo.get("/api/tasks").json() == []
    rejected = demo.post(f"/api/actions/{pending['pending_action_id']}/reject").json()
    assert rejected["status"] == "rejected"
    assert demo.get("/api/tasks").json() == []


def test_approved_write_tool_creates_resource_and_read_tool_audits(demo):
    pending = demo.post("/api/tools/create_task/invoke", json={"title": "Approved task", "priority": "medium"}).json()
    approved = demo.post(f"/api/actions/{pending['pending_action_id']}/approve").json()
    assert approved["status"] == "approved"
    tasks = demo.get("/api/tasks").json()
    assert len(tasks) == 1 and tasks[0]["title"] == "Approved task"

    result = demo.post("/api/tools/list_tasks/invoke", json={}).json()
    assert result["status"] == "executed" and result["result"][0]["title"] == "Approved task"


def test_agent_tool_parameters_are_validated_and_trust_can_be_set(demo):
    invalid = demo.post("/api/tools/create_task/invoke", json={"title": ""})
    assert invalid.status_code == 422
    trust = demo.patch("/api/tool-permissions/create_task", json={"trusted_for_session": True})
    assert trust.json()["trusted_for_session"] is True
    created = demo.post("/api/tools/create_task/invoke", json={"title": "Trusted task"}).json()
    assert created["status"] == "executed"


def test_debug_endpoint_keeps_recent_turn_metadata(demo):
    demo.post("/api/chat", json={"message": "hello"})
    turns = demo.get("/api/debug/last-turns").json()
    assert len(turns) == 1
    assert turns[0]["provider"] == "demo" and turns[0]["tool_calls"] == []
    assert "user_id" not in turns[0]


def test_model_tool_arguments_cannot_self_grant_external_consent():
    args = AnalyzeCodeArgs(workspace_id=1, path="src/app.py", consent_external=True)
    assert not hasattr(args, "consent_external")


def test_websocket_chat_sends_event_protocol(demo):
    token = demo.headers["Authorization"].removeprefix("Bearer ")
    with demo.websocket_connect("/ws/chat") as socket:
        socket.send_json({"token": token, "request": {"message": "hello"}})
        events = []
        while True:
            frame = socket.receive_json()
            events.append(frame["event"])
            if frame["event"] in {"done", "error"}:
                assert frame["event"] == "done"
                assert frame["data"]["output"]["answer"].startswith("[Demo mode")
                break
    assert "token" in events and "memory_recalled" in events and "debug" in events
