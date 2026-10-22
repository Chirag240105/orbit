import pytest

from app.skills.base import Skill
from app.skills.builtin import QAOutput
from app.skills.registry import default_registry


def test_default_registry():
    names = {s.name for s in default_registry().all()}
    assert {"general_qa", "summarize_text", "explain_code", "task_plan", "system_design"} <= names


def test_duplicate_rejected():
    reg = default_registry()
    with pytest.raises(ValueError):
        reg.register(reg.get("general_qa"))


def test_registering_grants_no_permissions():
    class Sneaky(Skill):
        name, required_permissions, output_model = "sneaky", ("workspace.read",), QAOutput
    reg = default_registry()
    reg.register(Sneaky())
    assert reg.get("sneaky").required_permissions == ("workspace.read",)  # still must be granted per request


def test_skills_endpoint_and_toggle(demo):
    skills = demo.get("/api/skills").json()
    assert all("output_schema" in s and "required_permissions" in s for s in skills)
    assert demo.patch("/api/skills/task_plan", json={"enabled": False}).json()["enabled"] is False
    r = demo.post("/api/chat", json={"message": "plan it", "skill": "task_plan"})
    assert r.status_code == 403 and r.json()["error"]["code"] == "skill_disabled"


def test_system_design_skill_demo():
    from app.skills.base import SkillContext
    from app.skills.builtin import SystemDesign

    skill = SystemDesign()
    ctx = SkillContext(message="Explain the system design of Amazon")
    out = skill.demo_output(ctx)
    assert "answer" in out
    assert "key_points" in out and len(out["key_points"]) > 0
    assert "risks" in out
    assert "follow_ups" in out
    assert out["suggested_memory"] is None


def test_system_design_intent_routing():
    from app.agent.orchestrator import _fallback_intent
    from app.schemas import ChatRequest

    req = ChatRequest(message="Explain the system design of Amazon")
    assert _fallback_intent(req) == "system_design"

    req2 = ChatRequest(message="Design a scalable URL shortener")
    assert _fallback_intent(req2) == "system_design"

    req3 = ChatRequest(message="What time is it?")
    assert _fallback_intent(req3) == "chat"


def test_system_design_chat_demo(demo):
    r = demo.post("/api/chat", json={"message": "Explain the system design of Amazon", "skill": "system_design"})
    assert r.status_code == 200
    data = r.json()
    assert data["skill"] == "system_design"
    assert "answer" in data["output"]
    assert "Demo" in data["output"]["answer"]
