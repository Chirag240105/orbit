# Architecture

```
Browser (React, :5173) --/api + X-Orbit-Token (added by the Vite proxy)--> FastAPI (127.0.0.1:8000) --> SQLite (Alembic migrations)
                                   |-- agent/orchestrator (chat) + agent/workflows (project agent, drafts, explanations)
                                   |        `--> providers/ (Nebius | demo | unconfigured), streaming over SSE
                                   |-- skills/ (registry: 6 chat skills, 3 workflow skills)   memory/ (stemmed keyword retrieval)
                                   `-- tools/ --> workspace/policy.py --> authorized folders on disk
```
Camera frames and marker detection stay in the browser (`frontend/src/lib/markers.ts`).

## Request flow: chat (`POST /api/chat`, or `/api/chat/stream` for server-sent events)
1. Token check (every route except `/api/health`), then the per-app rate limit.
2. **Routing:** an explicit skill, else (if `ORBIT_MODEL_ROUTING=true`) the model picks from enabled chat skills the request is allowed to use, else keyword patterns, else `general_qa`.
3. **Permission check:** the skill's `required_permissions` must be a subset of what the request is granted (`memory.read` always; `workspace.read` only with an authorized workspace).
4. Files are read through `workspace/policy.py`, then **redacted** and size-capped. Skills that declare `uses_workspace_summary` also get the project layout (file names, dependency names).
5. If workspace data (files or layout) would go to a hosted model and `consent_external` is false: `409 consent_required` with a preview. Nothing has been sent.
6. Memories are retrieved only for skills that declare `memory.read` (confirmed memories only).
7. Prompt: trusted system text + skill instructions + output format; earlier turns of the conversation (up to 6 messages) as chat history; memories, layout and files in `<untrusted_data>` fences whose content cannot imitate the fence or `<user_request>` tags.
8. The reply is parsed and validated against the skill's Pydantic model. On a mismatch ORBIT asks the model once to repair it (`ORBIT_REPAIR_RETRIES`), then falls back to plain text with a warning. Suggested memories are dropped unless grounded in what the user wrote and not sensitive.
9. Result and metadata (never file contents) are stored; `chat.external_send` is audited when workspace data left the machine.

Streaming sends `status` (thinking, validating), `token` (visible text; reasoning blocks are never streamed), then one `done` event with exactly the `/api/chat` response, or `error`. Validation happens once the whole reply has arrived.

## Request flow: project agent (`POST /api/workspaces/{id}/agent/notes`)
Fixed steps, each shown to the user: **read** (layout + selected files, locally, redacted) → consent → **analyze** (one model call, schema-validated) → **draft** (Markdown rendered by code, not by the model) → **propose** (a proposed change; nothing written) → **remember** (an unconfirmed project memory, reused if it already exists). Approval then writes the file and verifies it on disk. The user chooses the files, helped by `GET .../suggest` (local ranking).

## Request flow: file change
`POST /workspaces/{id}/changes` (manual) or `POST /workspaces/{id}/draft` (AI draft; secrets are replaced by numbered placeholders before sending and restored locally; line endings preserved) creates a **proposal**. `POST /changes/{id}/approve` calls the `apply_change` tool with `confirmed=True`: it needs the workspace's `allow_write`, re-validates the path, refuses a stale file (hash check), writes race-safely (directory file descriptors + `O_NOFOLLOW` on POSIX), and verifies the written hash.

## Trust boundaries
See `THREAT_MODEL.md`. In short: the model and all retrieved text are untrusted; the only code that touches the disk is `workspace/`; the API key never leaves the backend; the local API token never reaches the browser.

## Decisions
- **Single FastAPI process + SQLite, schema by Alembic.** The app runs `upgrade head` on start; a database from 0.1 is stamped at the baseline and upgraded. Postgres later by changing `ORBIT_DATABASE_URL`.
- **No open-ended model tool loop.** The agent is a fixed pipeline that ends at human approval gates. This shows decide → act → verify → remember without letting model text choose actions (prompt-injection risk, SEC-05). A model-driven loop can be revisited once Nemotron tool calling on Nebius is verified.
- **Keyword memory retrieval with stemming, no vector DB.** It beat plain keywords and tied BM25 on the labeled set (`MEMORY_DESIGN.md`).
- **Local web app first** (`DEPLOYMENT.md`). Tauri stays a stretch goal.
- **Typed contract:** response models on every endpoint, OpenAPI snapshot in `frontend/src/types/openapi.json`, generated TypeScript types, and a test that fails when they drift.
