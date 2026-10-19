# Architecture

```
Browser (React, :5173) --/api--> FastAPI (:8000) --> SQLite (orbit.db)
                                   |-- agent/orchestrator --> services/model_gateway (Nebius | NVIDIA | demo)
                                   |-- skills/ (registry)      memory/ (retrieval)
                                   `-- tools/ --> workspace/policy.py --> authorized folders on disk
```

## Request flow: chat
1. `POST /api/chat` (rate limited). The orchestrator picks a skill (explicit, else keyword routing among **enabled** skills).
2. **Permission check:** the skill's `required_permissions` must be a subset of what this request is granted (`memory.read` always; `workspace.read` only when an authorized workspace is selected).
3. Files are read through `workspace/policy.py`, then **redacted** and size-capped.
4. If a hosted model would receive file text and `consent_external` is false, the API returns `409 consent_required` with a preview (files, characters, redaction count). The UI shows a confirm dialog.
5. Matching **confirmed** memories are retrieved (keyword overlap).
6. Prompt: trusted system text + skill instructions + JSON schema; memories and files are wrapped in `<untrusted_data>` fences.
7. The model gateway routes through the configured OpenAI-compatible provider and model, with a timeout and one retry. It strips reasoning tags, records provider/model/token/latency metadata, and returns text; the orchestrator parses JSON and validates it against the skill's Pydantic model. On mismatch it falls back to plain text and adds a warning.
8. Result and metadata (never file contents) are stored; `chat.external_send` is audited when file text left the machine.

## Request flow: file change
`POST /workspaces/{id}/changes` creates a **proposal** (no write). `POST /changes/{id}/approve` calls the `apply_change` tool with `confirmed=True`; it requires the workspace's `allow_write` flag, re-validates the path, and refuses if the file changed since the proposal (hash check).

## Trust boundaries
See `THREAT_MODEL.md`. In short: the model and all retrieved text are untrusted; the only code that touches the disk is `workspace/`; the API key never leaves the backend.

## Decisions
- **Single FastAPI process + SQLite:** simplest thing two people can debug. Postgres later by changing `ORBIT_DATABASE_URL` (SQLAlchemy).
- **No model-driven tool loop in the MVP.** Tools run only from user-initiated API calls. This removes the largest prompt-injection risk until it can be properly tested (task SEC-05).
- **Keyword memory retrieval, no vector DB.** Embeddings are task AI-06 once there's a reason.
- **Local web app first.** Desktop packaging (Tauri) is task IN-04.
