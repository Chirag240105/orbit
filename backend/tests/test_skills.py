import pytest

from app.skills.base import Skill
from app.skills.builtin import QAOutput
from app.skills.registry import default_registry


def test_default_registry():
    names = {s.name for s in default_registry().all()}
    assert {"general_qa", "summarize_text", "explain_code", "task_plan"} <= names


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
