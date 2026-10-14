"""Example skill: turn rough notes into a standup update.
Copy to backend/app/skills/, then register it (see README.md in this folder)."""
from pydantic import BaseModel, Field

from app.skills.base import Skill, SkillContext


class StandupOutput(BaseModel):
    yesterday: list[str] = Field(default_factory=list)
    today: list[str] = Field(default_factory=list)
    blockers: list[str] = Field(default_factory=list)


class StandupNotes(Skill):
    name = "standup_notes"
    title = "Standup notes"
    description = "Turn rough notes into Yesterday / Today / Blockers."
    required_permissions = ()  # needs nothing: no memory, no files
    output_model = StandupOutput
    system_prompt = "Turn the user's rough notes into a concise standup update."

    def demo_output(self, ctx: SkillContext) -> dict:
        return {"yesterday": [], "today": [ctx.message[:100]], "blockers": []}

    def fallback_output(self, text: str) -> dict:
        return {"yesterday": [], "today": [text], "blockers": []}
