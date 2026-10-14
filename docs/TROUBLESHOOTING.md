# Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "Backend not reachable" | The backend isn't running on port 8000. Start everything with `python scripts/dev.py` |
| "ORBIT couldn't verify this page" (401 `unauthorized`) | The request had no valid local token. Open ORBIT from `http://localhost:5173` (the dev server adds the token), not the backend port. After restarting the backend, reload the page. If you set `ORBIT_TOKEN_FILE`, set it for both the backend and the frontend |
| Setup banner in chat, Send disabled | No key and no demo mode. Add `NEBIUS_API_KEY` to `.env` and restart, or `python scripts/dev.py --demo` |
| `provider_auth_failed` | The key was rejected: check `NEBIUS_API_KEY` |
| `provider_model_not_found` | Run `python scripts/list_models.py` and set `NEBIUS_MODEL` |
| `provider_empty_response` | Nemotron spent its budget reasoning. Retry, or raise `NEBIUS_MAX_TOKENS` |
| "The first reply did not match the expected structure…" | ORBIT repaired the reply automatically; nothing to do. Frequent fallbacks: run the live reliability test (`TESTING.md`) |
| Consent dialog every time | Expected with a hosted model whenever files or the project layout would be sent |
| `workspace_too_broad` | Choose a project folder, not `/`, a drive root, your home folder, or a top-level system folder |
| `path_excluded` | Secrets (`.env`, keys, `*secret*`, credentials) are never read or written |
| `stale_change` | The file changed after the proposal. Propose again so you review the current version |
| Approve refused: "Write access is disabled" | Turn on "Allow writes" for that workspace in Projects |
| 3D view shows "may not support WebGL" | Enable hardware acceleration or try another browser. Parts and explanations still work |
| Camera blocked | Allow it in the browser's site settings; it needs `localhost` or HTTPS |
| Marker not recognized | Turn on "Detect printed markers"; keep the white margin; print at least 5 cm wide; use even light; hold it steady for about a second |
| `Port 5173 is already in use` | Another dev server is running. Stop it, or end the old `node`/`vite` process |
| `alembic` errors on start with an old `orbit.db` | ORBIT stamps 0.1 databases automatically. If the file was edited by hand, back it up and delete it |
| Tests: symlink tests skipped on Windows | Expected without the symlink privilege; they run on Linux CI or WSL (`TESTING.md`) |
