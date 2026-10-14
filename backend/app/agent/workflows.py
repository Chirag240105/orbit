"""Multi-step agent workflows. Each step is fixed in code (no model-chosen tools), visible to the user, and
ends at a human approval gate: the model drafts, ORBIT proposes, the user decides, the write is verified.

project notes:  read (local) -> consent -> analyze (model) -> draft (Markdown) -> propose (no write) -> remember (suggestion)
draft change:   read (local) -> consent -> draft (model) -> restore secrets -> propose (no write)
"""
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.orchestrator import (
    audit_send,
    context_used,
    generate,
    provider_info,
    read_context,
    require_consent,
    require_enabled,
    require_permissions,
)
from app.audit.log import audit
from app.config import Settings
from app.core.errors import AppError
from app.models import Conversation, Memory, Message, ProposedChange, Workspace
from app.providers.base import ChatProvider
from app.schemas import (
    AgentRunOut,
    AgentStep,
    ChangeOut,
    ComponentExplainIn,
    ComponentExplainOut,
    DraftIn,
    DraftOut,
    MemoryOut,
    ProjectNotesIn,
)
from app.security.redaction import redact, restore
from app.skills.registry import SkillRegistry
from app.tools.registry import ToolContext, execute_tool
from app.workspace.policy import check_writable_target, resolve_inside

WORKSPACE_GRANTS = {"workspace.read", "workspace.propose", "memory.read"}


def render_notes(output: dict, workspace: str, goal: str, provider: str) -> str:
    """Deterministic Markdown from the validated notes structure (the model never writes the file directly)."""
    lines = [f"# {output.get('title') or 'Project notes'}", "", f"> Goal: {goal}  ", f"> Workspace: {workspace} · Written by ORBIT ({provider}). Review before relying on it.", ""]
    if output.get("summary"):
        lines += [output["summary"], ""]
    for sec in output.get("sections", []):
        lines += [f"## {sec.get('heading', '').strip() or 'Notes'}", "", sec.get("body", "").strip(), ""]
    if output.get("key_files"):
        lines += ["## Key files", "", *[f"- `{p}`" for p in output["key_files"]], ""]
    if output.get("open_questions"):
        lines += ["## Open questions", "", *[f"- {q}" for q in output["open_questions"]], ""]
    return "\n".join(lines).rstrip() + "\n"


def finalize_draft(new_content: str, original: str | None, secrets: dict[str, str]) -> tuple[str, list[str]]:
    """Model-written file content -> what may be proposed: secrets put back from their numbered placeholders, and the
    original file's line endings kept (models reply with \\n)."""
    warnings: list[str] = []
    new_content = restore(new_content, secrets)
    if "[REDACTED" in new_content:
        warnings.append("The draft still contains [REDACTED] placeholders. Approving it would replace real values; edit it first.")
    if original is not None and "\r\n" in original and "\r\n" not in new_content:
        new_content = new_content.replace("\n", "\r\n")
    return new_content, warnings


def _propose(db: Session, settings: Settings, ws: Workspace, path: str, content: str, description: str, origin: str) -> ProposedChange:
    ctx = ToolContext(db=db, settings=settings, workspace=ws, granted={"workspace.read", "workspace.propose"})
    change = execute_tool("propose_change", {"path": path, "new_content": content, "description": description[:300]}, ctx)
    change.origin = origin
    db.commit()
    return change


def _target(ws: Workspace, path: str, settings: Settings, content_hint: str = "") -> None:
    """Fail early (before any model call) if the path is outside the workspace, excluded, or not writable."""
    check_writable_target(resolve_inside(ws.path, path, must_exist=False), settings.max_file_bytes, content_hint)


async def run_project_notes(ws: Workspace, body: ProjectNotesIn, db: Session, settings: Settings, provider: ChatProvider, registry: SkillRegistry) -> AgentRunOut:
    skill = require_enabled(db, registry, "project_notes")
    require_permissions(skill, WORKSPACE_GRANTS)
    if not provider.configured:
        await provider.complete([])  # raises provider_not_configured
    if not body.notes_path.lower().endswith(".md"):
        raise AppError("invalid_path", "Notes must be saved as a Markdown (.md) file.", 400)
    _target(ws, body.notes_path, settings)

    c = read_context(db, settings, skill, body.goal, workspace=ws, file_paths=body.file_paths, extra={"workspace_name": ws.name})
    require_consent(c, provider, body.consent_external)
    steps = [AgentStep(name="read", status="done", detail=f"Read the project layout and {len(c.ctx.files)} selected file(s) locally"
                       + (f"; redacted {c.redactions} likely secret(s)" if c.redactions else "") + ".")]

    output, warnings, chars = await generate(c, provider, settings)
    audit_send(db, c, provider, chars, "agent.external_send")
    steps.append(AgentStep(name="analyze", status="done", detail=("Built placeholder notes (demo mode, no model)." if provider.is_demo else f"Analyzed with {provider.model}.")
                           + (f" {len(c.memory_ids)} memory item(s) used." if c.memory_ids else "")))

    markdown = render_notes(output, ws.name, body.goal, "demo mode" if provider.is_demo else provider.model)
    steps.append(AgentStep(name="draft", status="done", detail=f"Drafted {body.notes_path} ({markdown.count(chr(10))} lines)."))
    if redact(markdown)[1]:
        warnings.append("The drafted notes contain text that looks like a secret. Check them before approving.")

    change = _propose(db, settings, ws, body.notes_path, markdown, f"Agent notes: {body.goal}", "ai")
    steps.append(AgentStep(name="propose", status="done", detail="Created a proposed change. Nothing is written until you approve it."))

    memory = None
    fact = output.get("memory")
    if isinstance(fact, str) and fact.strip() and not redact(fact)[1]:
        content = f"[{ws.name}] {fact.strip()}"[:2000]
        memory = db.scalar(select(Memory).where(Memory.content == content))  # rerunning the agent must not duplicate it
        if memory is None:
            memory = Memory(content=content, type="project", source="agent", confirmed=False)
            db.add(memory)
            db.commit()
        steps.append(AgentStep(name="remember", status="done", detail="Already remembered this project fact." if memory.confirmed else "Suggested a project memory. It is not used until you confirm it."))
    else:
        steps.append(AgentStep(name="remember", status="skipped", detail="No project fact worth remembering was proposed."))

    conv = Conversation(title=f"Notes: {body.goal}"[:80])
    db.add(conv)
    db.commit()
    context = context_used(c, provider, chars, "explicit")
    db.add(Message(conversation_id=conv.id, role="user", content=f"[Project agent] {body.goal}"))
    db.add(Message(conversation_id=conv.id, role="assistant", content=json.dumps({"summary": output.get("summary", ""), "key_points": [s["heading"] for s in output.get("sections", [])]}),
                   skill=skill.name, meta={"provider": provider_info(provider).model_dump(), "context": context.model_dump(), "warnings": warnings, "change_id": change.id}))
    db.commit()
    audit(db, "agent.project_notes", workspace_id=ws.id, change_id=change.id, files=len(c.ctx.files))
    return AgentRunOut(conversation_id=conv.id, steps=steps, output=output, markdown=markdown, change=ChangeOut.model_validate(change),
                       memory=MemoryOut.model_validate(memory) if memory else None, provider=provider_info(provider), context=context, warnings=warnings)


async def run_draft(ws: Workspace, body: DraftIn, db: Session, settings: Settings, provider: ChatProvider, registry: SkillRegistry) -> DraftOut:
    skill = require_enabled(db, registry, "draft_change")
    require_permissions(skill, WORKSPACE_GRANTS)
    if not provider.configured:
        await provider.complete([])
    _target(ws, body.path, settings)
    exists = resolve_inside(ws.path, body.path, must_exist=False).exists()

    c = read_context(db, settings, skill, body.instruction, workspace=ws, file_paths=[body.path] if exists else [], reversible=True, extra={"path": body.path})
    if c.ctx.files and len(c.ctx.files[0][1]) >= settings.max_context_chars:
        raise AppError("file_too_large", "This file is larger than ORBIT can send for drafting. Edit it manually.", 413)
    require_consent(c, provider, body.consent_external)
    output, warnings, chars = await generate(c, provider, settings)
    audit_send(db, c, provider, chars, "agent.external_send")
    new_content = output.get("new_content", "")
    if not new_content.strip():
        raise AppError("draft_failed", "The model did not return a usable draft. Try rephrasing the instruction.", 502)
    original = restore(c.ctx.files[0][1], c.secrets) if c.ctx.files else None
    new_content, more = finalize_draft(new_content, original, c.secrets)
    warnings += more
    if original is not None and new_content == original:
        raise AppError("no_change", "The draft is identical to the current file.", 422)
    summary = output.get("summary") or "AI-drafted change"
    change = _propose(db, settings, ws, body.path, new_content, f"AI draft: {summary}", "ai")
    audit(db, "agent.draft", workspace_id=ws.id, change_id=change.id)
    return DraftOut(change=ChangeOut.model_validate(change), summary=summary, provider=provider_info(provider), context=context_used(c, provider, chars), warnings=warnings)


async def explain_component(body: ComponentExplainIn, db: Session, settings: Settings, provider: ChatProvider, registry: SkillRegistry) -> ComponentExplainOut:
    """AI-09. Without a configured model (or in demo mode) the curated text is returned, labeled as not AI-generated."""
    skill = require_enabled(db, registry, "explain_component")
    if not provider.configured or provider.is_demo:
        note = "Demo mode: showing the curated explanation. No model was called." if provider.is_demo else "No model is configured: showing the curated explanation."
        return ComponentExplainOut(explanation=body.details or body.summary, analogy="", failure_impact="", ai_generated=False, provider=None, warnings=[note])
    c = read_context(db, settings, skill, f"Explain {body.component}", extra=body.model_dump())
    output, warnings, _ = await generate(c, provider, settings)
    return ComponentExplainOut(explanation=output.get("explanation", ""), analogy=output.get("analogy", ""), failure_impact=output.get("failure_impact", ""),
                               ai_generated=True, provider=provider_info(provider), warnings=warnings)
