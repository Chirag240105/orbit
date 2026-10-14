# Team workflow (Chirag and Charanjeet)

- **Branches:** `main` is always runnable. Work on `feat/<task-id>-short-name` (e.g. `feat/ai-01-live-provider`). Merge by pull request.
- **Commits:** `<type>(<task-id>): summary`, types `feat fix docs test chore refactor`.
- **PR checklist:** acceptance criteria met; tests added; CI green; `.env.example` and docs updated if config changed; no secrets; TASKS.md status updated only after criteria are verified.
- **Reviews:** the other teammate reviews. Backend-touching PRs from Charanjeet and frontend-touching PRs from Chirag are welcome, with the area owner tagged.
- **API contracts:** change `backend/app/schemas.py` and `frontend/src/types/api.ts` in the same PR (or in two linked PRs merged together). Announce breaking changes before merging.
- **Avoiding conflicts:** Chirag mostly edits `backend/`; Charanjeet mostly edits `frontend/`. Shared files (`TASKS.md`, docs, `.env.example`): small commits, pull before editing.
- **Integrated testing:** `scripts/dev.sh`, then the smoke checklist in `TESTING.md`.
- **Blockers:** post it in your channel with the task ID, what you tried, and what you need; set the task to Blocked in TASKS.md.
