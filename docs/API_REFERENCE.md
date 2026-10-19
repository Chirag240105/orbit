# API reference (summary)

Live, authoritative docs: `http://127.0.0.1:8000/api/docs` while the backend runs. Errors always look like `{"error": {"code", "message", "details"}}`.

| Method and path | Purpose |
|---|---|
| `GET /api/health`, `GET /api/settings` | Status; provider state; tools; privacy notes |
| `POST /api/chat` | Run the agent. 409 `consent_required` when file text would go to a hosted model; 503 `provider_not_configured` |
| `WS /ws/chat` | First frame is `{token, request}`; receives `token`, `memory_recalled`, `tool_call`, `pending_action`, `debug`, then `done` or `error` |
| `POST /api/schedule/generate`, `GET /api/schedule?day=YYYY-MM-DD` | Create a deterministic schedule proposal, then read approved blocks |
| `GET /api/actions`, `POST /api/actions/{id}/approve | reject` | Review pending tool and schedule actions |
| `GET /api/debug/last-turns` | Recent debug metadata for the authenticated user's turns |
| `POST /api/code/explain` | Structured selection, file, project, or flow explanation; hosted code requires explicit consent |
| `GET/DELETE /api/conversations`, `GET .../{id}/messages`, `DELETE .../{id}` | History |
| `GET/POST /api/memories`, `PATCH/DELETE /api/memories/{id}`, `DELETE /api/memories` | Memory |
| `GET /api/skills`, `PATCH /api/skills/{name}` | Skill list and enable/disable |
| `GET/POST /api/workspaces`, `PATCH/DELETE /api/workspaces/{id}` | Authorized folders; `allow_write` |
| `GET /api/workspaces/{id}/tree \| summary \| search?q= \| file?path=` | Read-only inspection |
| `POST /api/workspaces/{id}/changes`, `GET /api/changes`, `POST /api/changes/{id}/approve \| reject` | Approval flow |
| `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/{id}` | Tasks (`proposed` → `todo` → `doing` → `done`) |
