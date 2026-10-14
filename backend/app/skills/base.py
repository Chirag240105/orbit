from dataclasses import dataclass, field

from pydantic import BaseModel, Field


class SkillInput(BaseModel):
    """Shared input contract for every skill."""

    message: str = Field(min_length=1, max_length=8000)
    files: list[str] = Field(default_factory=list, description="Relative paths inside the authorized workspace")


@dataclass
class SkillContext:
    message: str
    memories: list[str] = field(default_factory=list)
    files: list[tuple[str, str]] = field(default_factory=list)  # (path, redacted text)


class Skill:
    """A skill = metadata + prompt + output schema. Registering a skill grants NO permissions by itself:
    the orchestrator checks `required_permissions` against what the current request is actually granted."""

    name: str = ""
    title: str = ""
    description: str = ""
    required_permissions: tuple[str, ...] = ()
    requires_files: bool = False
    output_model: type[BaseModel]
    system_prompt: str = ""
    clarifying_question: str = "Which file should I look at? Select a workspace and a file path."

    def user_prompt(self, ctx: SkillContext) -> str:
        return ctx.message

    def demo_output(self, ctx: SkillContext) -> dict:
        return {"answer": f"[Demo mode] No model was called. Your request was: {ctx.message[:200]}"}

    def fallback_output(self, text: str) -> dict:
        return {"answer": text}
