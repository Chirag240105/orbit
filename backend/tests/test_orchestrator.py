"""Chat pipeline: history, memory permissions, routing (AI-03), repair (AI-02), new skills."""
import httpx

from app.skills.base import Skill
from app.skills.builtin import QAOutput
from tests.conftest import FakeModel, hosted


def _ws(c, root):
    r = c.post("/api/workspaces", json={"path": str(root)})
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ---------- conversation history ----------
def test_follow_up_includes_earlier_turns():
    model = FakeModel('{"answer": "Paris is the capital of France."}', '{"answer": "About 2.1 million people."}')
    with hosted(model) as c:
        first = c.post("/api/chat", json={"message": "What is the capital of France?"}).json()
        c.post("/api/chat", json={"message": "How many people live there?", "conversation_id": first["conversation_id"]})
    second = model.requests[1]["messages"]
    assert [m["role"] for m in second] == ["system", "user", "assistant", "user"]
    assert second[1]["content"] == "What is the capital of France?" and "Paris" in second[2]["content"]
    assert len(model.requests[0]["messages"]) == 2  # a new conversation has no history


def test_conversation_moves_to_top_after_new_message(demo):
    a = demo.post("/api/chat", json={"message": "first"}).json()["conversation_id"]
    demo.post("/api/chat", json={"message": "second"})
    demo.post("/api/chat", json={"message": "again", "conversation_id": a})
    assert demo.get("/api/conversations").json()[0]["id"] == a


# ---------- memory only for skills that declare memory.read ----------
def test_skill_without_memory_permission_gets_no_memories(demo):
    class NoMemory(Skill):
        name, title, description, output_model = "no_memory", "No memory", "test", QAOutput

    demo.app.state.registry.register(NoMemory())
    demo.post("/api/memories", json={"content": "I deploy with Docker"})
    j = demo.post("/api/chat", json={"message": "deploy with docker?", "skill": "no_memory"}).json()
    assert j["context"]["memory_ids"] == []
    assert demo.post("/api/chat", json={"message": "deploy with docker?", "skill": "general_qa"}).json()["context"]["memory_ids"]


# ---------- routing ----------
def test_kubernetes_lesson_routes_to_learn_topic(demo):
    j = demo.post("/api/chat", json={"message": "Explain Kubernetes like I'm a beginner, then give me a diagram, real-world example, and interview questions."}).json()
    assert j["skill"] == "learn_topic" and j["context"]["routing"] == "keywords" and "diagram" in j["output"]


def test_project_question_needs_a_workspace_to_route_to_project_overview(demo, auth_project):
    assert demo.post("/api/chat", json={"message": "Describe the architecture of this project"}).json()["skill"] == "general_qa"
    ws = _ws(demo, auth_project)
    j = demo.post("/api/chat", json={"message": "Describe the architecture of this project", "workspace_id": ws}).json()
    assert j["skill"] == "project_overview" and j["context"]["layout"] is True
    assert "express: listed in a manifest" in j["output"]["dependencies"]


def test_workflow_skills_are_not_chat_skills(demo):
    r = demo.post("/api/chat", json={"message": "x", "skill": "draft_change"})
    assert r.status_code == 400 and r.json()["error"]["code"] == "not_a_chat_skill"


def test_model_routing_picks_an_enabled_skill():
    model = FakeModel('{"skill": "task_plan"}', '{"summary": "Week plan", "tasks": [{"title": "Rest", "priority": "low"}]}')
    with hosted(model, model_routing=True) as c:
        j = c.post("/api/chat", json={"message": "organise my week"}).json()
    assert j["skill"] == "task_plan" and j["context"]["routing"] == "model" and j["proposed_tasks"][0]["priority"] == "low"
    assert "general_qa" in model.sent(0) and "draft_change" not in model.sent(0)  # workflow skills are never offered


def test_model_routing_ignores_unknown_and_disabled_skills():
    with hosted(FakeModel('{"skill": "delete_everything"}', '{"answer": "ok"}'), model_routing=True) as c:
        j = c.post("/api/chat", json={"message": "hello"}).json()
        assert (j["skill"], j["context"]["routing"]) == ("general_qa", "default")
    with hosted(FakeModel('{"skill": "task_plan"}', '{"answer": "ok"}'), model_routing=True) as c:
        c.patch("/api/skills/task_plan", json={"enabled": False})
        assert c.post("/api/chat", json={"message": "hello"}).json()["skill"] == "general_qa"


def test_model_routing_failure_falls_back_to_keywords():
    with hosted(FakeModel(httpx.Response(500), '{"summary": "s", "key_points": []}'), model_routing=True) as c:
        j = c.post("/api/chat", json={"message": "summarize: a long text"}).json()
    assert (j["skill"], j["context"]["routing"]) == ("summarize_text", "keywords")


def test_model_routing_is_skipped_in_demo_mode(demo):
    assert demo.post("/api/chat", json={"message": "hi"}).json()["context"]["routing"] == "default"


# ---------- structured output repair (AI-02) ----------
def test_invalid_reply_is_repaired_once():
    model = FakeModel("Sure! The answer is 4.", '{"answer": "4", "key_points": ["2+2"]}')
    with hosted(model) as c:
        j = c.post("/api/chat", json={"message": "what is 2+2"}).json()
    assert j["output"]["answer"] == "4" and "asked the model to fix it" in j["warnings"][0]
    assert len(model.requests) == 2 and "could not be used" in model.sent(1)


def test_missing_field_is_named_in_the_repair_request():
    model = FakeModel('{"key_points": []}', '{"answer": "fixed"}')
    with hosted(model) as c:
        assert c.post("/api/chat", json={"message": "q"}).json()["output"]["answer"] == "fixed"
    assert "answer" in model.requests[1]["messages"][-1]["content"]


def test_failed_repair_falls_back_to_text():
    model = FakeModel("plain words")
    with hosted(model) as c:
        j = c.post("/api/chat", json={"message": "q"}).json()
    assert j["output"]["answer"] == "plain words" and "plain text" in j["warnings"][0] and len(model.requests) == 2


def test_repair_can_be_disabled():
    model = FakeModel("plain words")
    with hosted(model, repair_retries=0) as c:
        c.post("/api/chat", json={"message": "q"})
    assert len(model.requests) == 1


# ---------- consent covers the project layout ----------
def test_project_overview_asks_consent_for_the_layout(auth_project):
    model = FakeModel('{"overview": "A login service", "components": ["app/auth: login"]}')
    with hosted(model) as c:
        ws = _ws(c, auth_project)
        body = {"message": "explain the architecture of this project", "workspace_id": ws}
        r = c.post("/api/chat", json=body)
        assert r.status_code == 409 and r.json()["error"]["details"]["layout"] is True and r.json()["error"]["details"]["files"] == []
        assert model.requests == []
        j = c.post("/api/chat", json={**body, "consent_external": True}).json()
    assert j["output"]["overview"] == "A login service"
    sent = model.sent()
    assert "workspace_layout" in sent and "fastapi" in sent and "do-not-read-me" not in sent
