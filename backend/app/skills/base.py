import json
import re
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
    workspace_summary: dict | None = None
    extra: dict = field(default_factory=dict)  # workflow-specific inputs (target path, scene, ...)


def parse_json_object(text: str) -> dict | None:
    """Extract the outermost JSON object from a model reply (tolerates code fences and prose around it)."""
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(text[start : end + 1])
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


class Skill:
    """A skill = metadata + prompt + output schema. Registering a skill grants NO permissions by itself:
    the orchestrator checks `required_permissions` against what the current request is actually granted,
    and only skills that declare `memory.read` receive memories."""

    name: str = ""
    title: str = ""
    description: str = ""
    required_permissions: tuple[str, ...] = ()
    requires_files: bool = False
    uses_workspace_summary: bool = False  # file names and dependency names are sent (needs consent if hosted)
    invocation: str = "chat"  # "chat": routable and selectable in chat; "workflow": only used by its own endpoint
    route_pattern: str = ""  # keyword routing (regex on the lowercased message) when no skill is chosen
    max_tokens: int | None = None
    output_model: type[BaseModel]
    system_prompt: str = ""
    clarifying_question: str = "Which file should I look at? Select a workspace and a file path."

    def user_prompt(self, ctx: SkillContext) -> str:
        return ctx.message

    def format_instructions(self) -> str:
        schema = json.dumps(self.output_model.model_json_schema().get("properties", {}))
        return f" Respond with ONLY a JSON object with these properties: {schema}"

    def parse(self, text: str) -> dict | None:
        return parse_json_object(text)

    def demo_output(self, ctx: SkillContext) -> dict:
        return {"answer": f"[Demo mode] No model was called. Your request was: {ctx.message[:200]}"}

    def fallback_output(self, text: str) -> dict:
        return {"answer": text}
