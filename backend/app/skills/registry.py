from app.skills.base import Skill
from app.skills.builtin import (
    DraftChange,
    ExplainCode,
    ExplainComponent,
    GeneralQA,
    LearnTopic,
    ProjectNotes,
    ProjectOverview,
    SummarizeText,
    TaskPlan,
)


class SkillRegistry:
    def __init__(self) -> None:
        self._skills: dict[str, Skill] = {}

    def register(self, skill: Skill) -> None:
        if not skill.name or skill.name in self._skills:
            raise ValueError(f"Invalid or duplicate skill name: {skill.name!r}")
        self._skills[skill.name] = skill

    def get(self, name: str) -> Skill | None:
        return self._skills.get(name)

    def all(self) -> list[Skill]:
        return list(self._skills.values())


def default_registry() -> SkillRegistry:
    """Registration order is the keyword-routing priority for chat skills (first match wins);
    general_qa has no pattern and is the default."""
    reg = SkillRegistry()
    for s in (
        GeneralQA(), ExplainCode(), ProjectOverview(), LearnTopic(), SummarizeText(), TaskPlan(),
        ProjectNotes(), DraftChange(), ExplainComponent(),
    ):
        reg.register(s)
    return reg
