# Contributing

1. Pick a task from `TASKS.md` (see "How to Pick Up the Next Task").
2. Branch: `feat/<task-id>-short-name`. Commit: `type(task-id): summary`.
3. Before opening a PR: `cd backend && pytest -q --cov=app && ruff check app tests ../examples`; `cd frontend && npm run typecheck && npm test && npm run build`. If you changed the API: `python -m app.openapi_export` and `npm run gen:types`.
4. PR must meet the Definition of Done in `TASKS.md`. Security-sensitive changes (`workspace/`, `tools/`, `security/`, `agent/`) need a test for the failure case, not only the happy path.
5. Never commit `.env`, keys, databases, or personal files. Tests must not use real credentials.
