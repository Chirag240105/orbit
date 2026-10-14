"""Agent mode (AG-02): an opt-in loop in which the model chooses the next step toward the user's goal.

Guardrails, all enforced in code (the model's text is never trusted):
- Allowlist: list/search/suggest/read files, propose a change, finish. There is no write tool in the list, so the
  agent cannot change disk: proposals wait for the user's approval in Projects like any other change.
- Every tool call goes through `execute_tool` (input validation, permission check, path policy, audit).
- Caps: steps, files read, proposals. A file must be read before a change to it can be proposed.
- Consent before the run when a hosted model is used. File text is redacted with numbered placeholders that are
  restored locally in proposals. Tool results are fenced as untrusted data.
- The skill is opt-in (`default_enabled = False`): off until the user turns it on in Skills.
The protocol is one JSON action per model turn, so it works without provider-specific tool calling."""
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from pydantic import ValidationError

from app.agent.orchestrator import (
    SECURITY_PREAMBLE,
    provider_info,
    require_enabled,
    require_permissions,
    sse,
)
from app.agent.workflows import WORKSPACE_GRANTS, finalize_draft
from app.audit.log import audit
from app.config import Settings
from app.core.errors import AppError
from app.db.session import new_session
from app.models import Conversation, Message, Workspace
from app.providers.base import ChatProvider
from app.schemas import AgentLoopIn, ChangeOut
from app.security.redaction import fence_untrusted, redact_reversible
from app.skills.base import Skill
from app.skills.builtin import AgentAction
from app.skills.registry import SkillRegistry
from app.tools.registry import ToolContext, execute_tool
from app.workspace.policy import resolve_inside
from app.workspace.service import summarize

LOOP_TOOLS = ("list_files", "search_files", "suggest_files", "read_file", "propose_change")
MAX_READS, MAX_PROPOSALS, OBS_CHARS = 8, 3, 6000


@dataclass
class LoopPlan:
    workspace_id: int
    goal: str
    max_steps: int
    skill: Skill
    summary: dict


@dataclass
class LoopState:
    secrets: dict[str, str] = field(default_factory=dict)
    originals: dict[str, str] = field(default_factory=dict)  # path -> file text as read (secrets intact)
    reads: int = 0
    proposals: list = field(default_factory=list)
    steps: list[dict] = field(default_factory=list)
    last_paths: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


async def prepare_loop(ws: Workspace, body: AgentLoopIn, db, settings: Settings, provider: ChatProvider, registry: SkillRegistry) -> LoopPlan:
    """Checks before anything runs; raises normal JSON errors (403 disabled, 409 consent, 503 unconfigured)."""
    skill = require_enabled(db, registry, "agent_mode")
    require_permissions(skill, WORKSPACE_GRANTS)
    if not provider.configured:
        await provider.complete([])  # raises provider_not_configured
    if not provider.is_demo and not body.consent_external:
        raise AppError(
            "consent_required",
            "In agent mode the model chooses which files to read. Their redacted text, and the project layout, go to the hosted model.",
            409,
            {"files": [], "layout": True, "agent": True, "max_files": MAX_READS, "chars": MAX_READS * OBS_CHARS, "redactions": 0,
             "provider": provider.name, "model": provider.model},
        )
    return LoopPlan(workspace_id=ws.id, goal=body.goal, max_steps=body.max_steps, skill=skill, summary=summarize(ws.path, settings.max_file_bytes))


async def next_action(messages: list[dict], skill: Skill, provider: ChatProvider) -> tuple[AgentAction | None, str]:
    """One model turn -> a validated action, with one repair attempt."""
    text = (await provider.complete(messages, max_tokens=skill.max_tokens)).text
    for attempt in range(2):
        data = skill.parse(text)
        try:
            return AgentAction(**(data or {})), text
        except (ValidationError, TypeError):
            if attempt == 1:
                break
            text = (await provider.complete([*messages, {"role": "assistant", "content": text[:4000]},
                                             {"role": "user", "content": 'That was not a valid action. Reply with ONLY {"thought": "...", "tool": "<name>", "args": {...}}.'}],
                                            max_tokens=skill.max_tokens)).text
    return None, text


def _display(args: dict) -> dict:
    return {k: (f"<{len(v)} characters>" if k == "new_content" and isinstance(v, str) else str(v)[:200]) for k, v in args.items()}


def run_tool(action: AgentAction, ctx: ToolContext, state: LoopState) -> tuple[bool, str]:
    """Execute one allowed tool. Returns (ok, observation for the model). Never raises for model mistakes."""
    tool, args = action.tool, dict(action.args)
    if tool not in LOOP_TOOLS:
        return False, f"error: '{tool}' is not an available tool. Available: {', '.join(LOOP_TOOLS)}, finish."
    try:
        if tool == "read_file":
            if state.reads >= MAX_READS:
                return False, f"error: the limit of {MAX_READS} files per run is reached. Finish or propose a change."
            result = execute_tool("read_file", {"path": args.get("path", "")}, ctx)
            state.originals[result["path"]] = result["content"]
            state.reads += 1
            text, _ = redact_reversible(result["content"], state.secrets)
            cut = "\n[truncated]" if len(text) > OBS_CHARS else ""
            return True, f"{result['path']}:\n{text[:OBS_CHARS]}{cut}"
        if tool == "propose_change":
            if len(state.proposals) >= MAX_PROPOSALS:
                return False, f"error: the limit of {MAX_PROPOSALS} proposals per run is reached. Finish now."
            path, new = args.get("path"), args.get("new_content")
            if not isinstance(path, str) or not isinstance(new, str) or not new.strip():
                return False, "error: propose_change needs a path and the complete new_content."
            if resolve_inside(ctx.workspace.path, path, must_exist=False).exists() and path not in state.originals:
                return False, f"error: read_file {path} before proposing a change to it."
            content, warns = finalize_draft(new, state.originals.get(path), state.secrets)
            if content == state.originals.get(path):
                return False, "error: the proposed content is identical to the current file."
            change = execute_tool("propose_change", {"path": path, "new_content": content, "description": f"Agent: {args.get('description') or 'proposed change'}"[:300]}, ctx)
            change.origin = "ai"
            ctx.db.commit()
            state.proposals.append(change)
            state.warnings += warns
            return True, f"Proposal #{change.id} created for {path}. It waits for the user's approval; nothing was written."
        result = execute_tool(tool, args if tool != "list_files" else {}, ctx)
        if tool == "list_files":
            state.last_paths = [f["path"] for f in result]
            return True, "\n".join(f"{f['path']} ({f['size']} bytes)" for f in result[:200]) or "(no readable files)"
        state.last_paths = [r["path"] for r in result]
        return True, json.dumps(result)[:OBS_CHARS] if result else "(no results)"
    except AppError as exc:
        return False, f"error: {exc.code}: {exc.message}"


def demo_action(n: int, plan: LoopPlan, state: LoopState) -> AgentAction:
    """Deterministic, labeled stand-in for the model in demo mode: rank, read the top file, finish."""
    if n == 1:
        return AgentAction(thought="[Demo] Find files related to the goal.", tool="suggest_files", args={"query": plan.goal})
    if n == 2 and state.last_paths:
        return AgentAction(thought="[Demo] Read the most relevant file.", tool="read_file", args={"path": state.last_paths[0]})
    if n == 2:
        return AgentAction(thought="[Demo] Nothing matched; list the files.", tool="list_files", args={})
    read = next(iter(state.originals), None)
    answer = (f"[Demo mode, not model inference] I ranked the files for your goal and read {read} "
              f"({state.originals[read].count(chr(10)) + 1} lines). A real model would now analyze it and could propose changes for your approval."
              if read else "[Demo mode, not model inference] I looked at the project layout. A real model would plan the next steps.")
    return AgentAction(thought="[Demo] Report back.", tool="finish", args={"answer": answer})


async def run_loop(plan: LoopPlan, settings: Settings, provider: ChatProvider) -> AsyncIterator[str]:
    """Server-sent events: one `step` per tool call (and the final `finish`), then `done`, or `error`."""
    try:
        with new_session() as db:
            ws = db.get(Workspace, plan.workspace_id)
            if ws is None:
                raise AppError("not_found", "Workspace not found.", 404)
            ctx = ToolContext(db=db, settings=settings, workspace=ws, granted={"workspace.read", "workspace.propose"})
            state = LoopState()
            messages = [
                {"role": "system", "content": SECURITY_PREAMBLE + plan.skill.system_prompt},
                {"role": "user", "content": f"<user_request>\n{plan.goal}\n</user_request>\n\n" + fence_untrusted("workspace_layout", json.dumps(plan.summary))},
            ]
            answer = f"Stopped after {plan.max_steps} steps without finishing. Review any proposals below."
            for n in range(1, plan.max_steps + 1):
                if provider.is_demo:
                    action = demo_action(n, plan, state)
                else:
                    action, raw = await next_action(messages, plan.skill, provider)
                    if action is None:
                        answer = "The model's reply could not be used as an action, so the agent stopped."
                        state.steps.append({"n": n, "thought": "", "tool": "invalid", "args": {}, "ok": False, "observation": raw[:300]})
                        yield sse("step", state.steps[-1])
                        break
                    messages.append({"role": "assistant", "content": raw[:4000]})
                if action.tool == "finish":
                    answer = str(action.args.get("answer") or "").strip() or "(The agent finished without an answer.)"
                    state.steps.append({"n": n, "thought": action.thought[:500], "tool": "finish", "args": {}, "ok": True, "observation": ""})
                    yield sse("step", state.steps[-1])
                    break
                ok, observation = run_tool(action, ctx, state)
                state.steps.append({"n": n, "thought": action.thought[:500], "tool": action.tool, "args": _display(action.args), "ok": ok, "observation": observation[:600]})
                yield sse("step", state.steps[-1])
                if not provider.is_demo:
                    messages.append({"role": "user", "content": fence_untrusted(f"tool:{action.tool}", observation) + "\nNext action?"})

            conv = Conversation(title=f"Agent: {plan.goal}"[:80])
            db.add(conv)
            db.commit()
            db.add(Message(conversation_id=conv.id, role="user", content=f"[Agent mode] {plan.goal}"))
            db.add(Message(conversation_id=conv.id, role="assistant", skill="agent_mode",
                           content=json.dumps({"answer": answer, "key_points": [f"{s['tool']} {json.dumps(s['args'])}" for s in state.steps if s["tool"] != "finish"]}),
                           meta={"provider": provider_info(provider).model_dump(), "warnings": state.warnings, "proposals": [c.id for c in state.proposals]}))
            db.commit()
            audit(db, "agent.loop", workspace_id=ws.id, steps=len(state.steps), reads=state.reads, proposals=len(state.proposals), external=not provider.is_demo)
            if provider.is_demo:
                state.warnings.insert(0, "Demo mode: a fixed script stands in for the model. No model was called.")
            yield sse("done", {"conversation_id": conv.id, "answer": answer, "steps": len(state.steps), "reads": state.reads,
                               "proposals": [ChangeOut.model_validate(c).model_dump(mode="json") for c in state.proposals],
                               "provider": provider_info(provider).model_dump(), "warnings": state.warnings})
    except AppError as exc:
        yield sse("error", {"code": exc.code, "message": exc.message})
    except Exception:  # noqa: BLE001  (never leak internals into the stream)
        yield sse("error", {"code": "internal_error", "message": "Something went wrong on the server."})
