"""Run from backend/:  pytest ../examples/example-skill -q"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from standup_notes import StandupNotes  # noqa: E402

from app.skills.registry import default_registry  # noqa: E402


def test_registers_and_declares_no_permissions():
    reg = default_registry()
    reg.register(StandupNotes())
    assert reg.get("standup_notes").required_permissions == ()


def test_demo_output_matches_schema():
    from app.skills.base import SkillContext
    out = StandupNotes().demo_output(SkillContext(message="finished login page"))
    assert StandupNotes.output_model(**out).today == ["finished login page"]
