# Deployment and packaging

## Decision (IN-04): local web app for the demo; Tauri is a stretch goal
**Status: proposed. Needs both teammates to agree.**

| Option | For | Against |
|---|---|---|
| **Local web app** (`python scripts/dev.py`) | Works today on Windows, macOS, Linux; one command; verified end to end in a real browser; nothing extra to install | Not "always on"; typed folder paths; two processes |
| Tauri desktop app | Native folder picker (SEC-02), tray icon, closer to "always-on" | Needs Rust and a Python sidecar (PyInstaller) per OS, plus signing; roughly 2–4 days of packaging work and new failure modes, with 15 days left before the deadline |
| Docker Compose | One command | The container can only see mounted folders, which breaks "authorize any folder"; Docker Desktop is heavy for a personal assistant |

Rationale: a complete, working product matters more than packaging right now. Packaging risk is better spent on AI-01 (the live model) and the demo. If time remains after DEMO-01, try Tauri on one OS and keep the web app as the fallback.

## Running locally
```bash
python scripts/dev.py            # installs missing dependencies, creates .env from .env.example, starts both servers
python scripts/dev.py --demo     # same, with labeled demo output and no model calls
```
Backend: `127.0.0.1:8000` only. Frontend dev server: `localhost:5173` (proxies `/api` and adds the local token). `scripts/dev.sh` still works on macOS/Linux.

Production-style build: `cd frontend && npm run build && npm run preview` serves `dist/` on `:4173` with the same token-adding proxy; the backend runs as above.

## Folder selection (SEC-02)
Browsers never reveal absolute paths from a folder picker, so the web app asks for a typed path that the backend validates (`WORKSPACE_ACCESS.md`). A native picker becomes possible with the Tauri option.

## Not supported
Remote or multi-user hosting: the API trusts whoever holds the local token, and the rate limiter and token are per-process. Do not expose port 8000.
