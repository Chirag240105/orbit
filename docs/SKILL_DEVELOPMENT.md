# Writing a skill

A skill is a `Skill` subclass (`backend/app/skills/base.py`) with: `name`, `title`, `description`, `required_permissions`, `output_model` (Pydantic), `system_prompt`, and `demo_output()` / `fallback_output()`.

Permissions: `memory.read` (retrieved memories are included), `workspace.read` (needs an authorized workspace in the request). A skill that declares nothing gets nothing. **Registering a skill never grants permissions**; the orchestrator compares `required_permissions` with what the request is granted.

Steps: write the class, add it to `default_registry()`, add tests (registration, output schema, permission behavior), restart. Full worked example: `examples/example-skill/`.

Prompt rules: put instructions in `system_prompt`; never interpolate files or memories into it. The orchestrator wraps them in `<untrusted_data>` fences for you.
