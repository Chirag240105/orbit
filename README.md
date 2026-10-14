# ORBIT: Your Personal AI Operating Layer

One personal agent. Shared memory. Reusable skills. Permission-controlled actions. A structured interface for understanding and acting.

ORBIT is a local-first desktop-style web app for developers and students who want an AI assistant that remembers only what they approve, can read only the folders they authorize, and never changes a file without an explicit approval. Built for the NVIDIA x Nebius Personal AI hackathon track by Chirag (agent, backend, security) and Charanjeet (frontend, UX).

## Three capabilities
- **A. Chat and skills:** natural-language requests routed to reusable skills with validated structured output and user-approved memory.
- **B. Visual Learning Studio:** an interactive 3D cloud-architecture scene with step-by-step learning and an opt-in camera panel.
- **C. Workspace intelligence:** authorize a folder, then list, search, preview and explain files; propose changes that need approval.

## Feature status (read this first)

| Feature | Status |
|---|---|
| Backend API, DB, error handling, CORS, rate limit, audit | **Working**, 51 automated tests |
| Chat orchestration, skill registry (4 skills), schema-validated output | **Working** (tested with demo provider and mocked HTTP) |
| Nebius + Nemotron provider | **Implemented, unverified against the live API.** Needs your key; default model ID is a guess to confirm (`scripts/list_models.py`) |
| Demo mode (`ORBIT_DEMO_MODE=true`) | **Mocked on purpose**: deterministic, labeled "Demo", no model call |
| Memory (add, edit, search, confirm, delete, delete all) | **Working** (keyword retrieval, not embeddings) |
| Workspace policy, read-only inspection, proposal and approval flow | **Working**, unit and API tested |
| Secret redaction, consent before external send | **Working**, best-effort redaction |
| All 8 screens | **Built**; typecheck, 10 tests and production build pass. **Not yet reviewed in a real browser** |
| 3D scene and camera panel | **Built, not verified in a browser or on a device** |
| OpenCV / MediaPipe recognition | **Not implemented** (tasks CV-01, CV-02) |
| Alembic migrations | **Scaffolded only**; tables are created with `create_all` |
| Streaming, local API token, Docker, Tauri, model-driven tool use | **Planned** (see `TASKS.md`) |

## Architecture
React frontend → FastAPI backend (127.0.0.1) → SQLite. The backend owns the API key, the file policy, memory, and the model call. See `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/SECURITY_MODEL.md`.

**Why this stack:** FastAPI and Pydantic give typed validation with little code; SQLite needs no server; React + TypeScript + Vite is quick for two people; React Three Fiber fits the 3D scene. No vector DB, Redis, or microservices because nothing needs them yet.

## Privacy: what leaves your computer
With a provider configured, your chat messages and matching memories go to the hosted model (Nebius). File excerpts go only if you select them, after redaction, and after you confirm in a dialog. Indexing, search, permissions and the database stay local. Camera video stays in the browser. Demo mode sends nothing. ORBIT is **not** fully local while hosted inference is on.

## Setup
Prerequisites: Python 3.11+, Node 20+ (tested on Python 3.12, Node 22).

```bash
cp .env.example .env            # edit: NEBIUS_API_KEY=...  (or ORBIT_DEMO_MODE=true to try the UI)
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app_factory --factory --reload     # http://127.0.0.1:8000/api/docs
# new terminal
cd frontend && npm install && npm run dev            # http://localhost:5173
```
Or run both with `scripts/dev.sh` after installing each. Never commit `.env`.

**Environment variables:** `NEBIUS_API_KEY`, `NEBIUS_BASE_URL` (default `https://api.tokenfactory.nebius.com/v1/`), `NEBIUS_MODEL`, `ORBIT_DEMO_MODE`, `ORBIT_DATABASE_URL`, `ORBIT_ALLOWED_ORIGINS`, `ORBIT_MAX_FILE_BYTES`. Details in `.env.example`.

**Tests:** see `docs/TESTING.md` (`pytest -q`, `ruff check`, `npm run typecheck`, `npm test`, `npm run build`).

**Trying the workspace features safely:** authorize `examples/example-project` in Projects.

## Troubleshooting
- *"Backend not reachable":* start uvicorn on port 8000 (the Vite dev server proxies `/api`).
- *Setup banner in chat:* no key and no demo mode set; edit `.env` and restart the backend.
- *`provider_model_not_found`:* run `python scripts/list_models.py` and set `NEBIUS_MODEL`.
- *`provider_empty_response`:* Nemotron on Token Factory is a reasoning model and can spend its budget thinking; retry.
- *3D view blank:* WebGL is unavailable or disabled in the browser.
- *Camera blocked:* allow it in the browser's site settings; it needs `localhost` or HTTPS.
- *`workspace_too_broad`:* choose a project folder, not `/`, your home folder, or a top-level system folder.

## Limitations
Single user, no authentication on the local API yet (SEC-01). Redaction is pattern-based and incomplete. The model cannot call tools in this version. Camera recognition does not exist. Memory retrieval is keyword-based.

## Team and contributing
Chirag: AI agent, backend architecture, integrations, security. Charanjeet: frontend, UI/UX, visual learning, integration. Work from `TASKS.md`; process in `docs/TEAM_WORKFLOW.md` and `CONTRIBUTING.md`. To add a feature, a skill, or a screen: `docs/EXTENDING.md`, `docs/SKILL_DEVELOPMENT.md`.
