# Writing a skill

A skill is a `Skill` subclass (`backend/app/skills/base.py`) with: `name`, `title`, `description`, `required_permissions`, `output_model` (Pydantic), `system_prompt`, and `demo_output()` / `fallback_output()`. Optional:

| Attribute / hook | Use |
|---|---|
| `route_pattern` | Regex on the lowercased message for keyword routing. Registration order in `default_registry()` is the priority; `general_qa` is the default |
| `requires_files` | Ask a clarifying question when no file is attached |
| `uses_workspace_summary` | Receive the project layout and dependency names (consent applies before a hosted send) |
| `invocation = "workflow"` | Not routable or selectable in chat; used by its own endpoint (project agent, drafts, scene explanations) |
| `max_tokens` | Per-skill output budget |
| `user_prompt(ctx)`, `format_instructions()`, `parse(text)` | Change how the request is phrased and how the reply is parsed (default: JSON object matching `output_model`) |

Permissions: `memory.read` (retrieved memories are included), `workspace.read` (needs an authorized workspace in the request), `workspace.propose` (workflow skills that create proposals). A skill that declares nothing gets nothing, including no memories. **Registering a skill never grants permissions**; the orchestrator compares `required_permissions` with what the request is granted.

Output reliability: if the reply doesn't match `output_model`, ORBIT asks the model once to repair it (naming the missing fields), then uses `fallback_output(text)` with a warning. A `suggested_memory` field is kept only if it passes `memory.service.vet_suggestion`.

Steps: write the class, add it to `default_registry()`, add tests (registration, output schema, permission behavior, demo output), run `python -m app.openapi_export` if you changed schemas, restart. Full worked example: `examples/example-skill/`.

Prompt rules: put instructions in `system_prompt`; never interpolate files or memories into it. The orchestrator wraps them in `<untrusted_data>` fences for you.
