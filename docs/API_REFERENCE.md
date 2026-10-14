# API reference (summary)

Live, authoritative docs: `http://127.0.0.1:8000/api/docs` while the backend runs. The same contract is committed as `frontend/src/types/openapi.json` (`python -m app.openapi_export` regenerates it; `tests/test_contract.py` fails if it is stale).

Every route except `GET /api/health` needs the header `X-Orbit-Token` (the Vite proxy adds it; see `SECURITY_MODEL.md`). Errors always look like `{"error": {"code", "message", "details"}}`.

| Method and path | Purpose |
|---|---|
| `GET /api/health` | Liveness and provider state (no token needed) |
| `GET /api/settings` | Provider, limits, routing mode, tools, privacy notes |
| `POST /api/chat` | Run the agent. 409 `consent_required` when workspace data would go to a hosted model; 503 `provider_not_configured`; 429 `rate_limited` |
| `POST /api/chat/stream` | Same, as server-sent events: `status`, `token`, then `done` (the `/api/chat` response) or `error` |
| `GET/DELETE /api/conversations`, `GET .../{id}/messages`, `DELETE .../{id}` | History |
| `GET/POST /api/memories`, `PATCH/DELETE /api/memories/{id}`, `DELETE /api/memories` | Memory |
| `GET /api/skills`, `PATCH /api/skills/{name}` | Skills (chat and workflow) and enable/disable |
| `GET/POST /api/workspaces`, `PATCH/DELETE /api/workspaces/{id}` | Authorized folders; `allow_write` |
| `GET /api/workspaces/{id}/tree \| summary \| search?q= \| suggest?q= \| file?path=` | Read-only inspection; `suggest` ranks files for a question locally |
| `POST /api/workspaces/{id}/changes` | Propose a change you wrote |
| `POST /api/workspaces/{id}/draft` | AI drafts a change to one file (becomes a proposal; consent applies) |
| `POST /api/workspaces/{id}/agent/notes` | Project agent: analyze files for a goal, propose a notes file, suggest a project memory |
| `GET /api/changes`, `POST /api/changes/{id}/approve \| reject` | Approval flow (approve writes and verifies) |
| `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/{id}` | Tasks (`proposed` → `todo` → `doing` → `done`) |
| `POST /api/learn/explain` | AI explanation of a 3D scene part; curated text when no model is configured |
