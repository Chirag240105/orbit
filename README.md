# ORBIT: Your Personal AI Operating Layer

One personal agent. Shared memory. Reusable skills. Permission-controlled actions. A structured interface for understanding and acting.

ORBIT is a persistent, multimodal personal AI for developers and students. It remembers approved work context, helps plan tasks, explains authorized code, and prepares actions for explicit approval. Built for the NVIDIA x Nebius Personal AI hackathon track by Chirag (agent, backend, security) and Charanjeet (frontend, UX).

## Three capabilities
- **A. Chat and skills:** natural-language requests routed to reusable skills with validated structured output and user-approved memory.
- **B. Vision:** a browser-only camera preview and curated 3D scene. Gesture recognition is not implemented yet.
- **C. Workspace intelligence:** authorize a folder, then list, search, preview and explain files; propose changes that need approval.

## Feature status (read this first)

| Feature | Status |
|---|---|
| Backend API, DB, error handling, CORS, rate limit, audit | **Working**, 56 passed and 2 skipped in the current suite |
| Chat orchestration, skill registry (4 skills), schema-validated output | **Working** (tested with demo provider and mocked HTTP) |
| Nebius and NVIDIA OpenAI-compatible gateway | **Gateway implemented; live calls unverified.** Choose task model IDs with `scripts/list_models.py`; needs a provider key |
| Demo mode (`LLM_PROVIDER=demo`, `ORBIT_DEMO_MODE=true`, or `ORBIT_MOCK_AI=true`) | **Deterministic placeholder**: labeled "Demo", no model call |
| Memory (add, edit, search, confirm, delete, delete all) | **Working** (keyword retrieval, not embeddings) |
| Workspace policy, read-only inspection, proposal and approval flow | **Working**, unit and API tested |
| Secret redaction, consent before external send | **Working**, best-effort redaction |
| All 8 screens | **Built**; typecheck, 10 tests and production build pass. **Not yet reviewed in a real browser** |
| 3D scene and camera panel | **Built, not verified in a browser or on a device** |
| OpenCV / MediaPipe recognition | **Not implemented** (tasks CV-01, CV-02) |
| Alembic migrations | **Scaffolded only**; tables are created with `create_all` |
| Streaming, multi-user auth, PostgreSQL/pgvector, schedule generation, model-driven tool use, VS Code extension | **Planned** (see `TASKS.md` and `docs/GAP_ANALYSIS.md`) |

## Architecture
React frontend → FastAPI backend → model gateway and current SQLite data store. The backend owns provider keys, file policy, memory, and model calls. PostgreSQL/pgvector is planned. See `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/SECURITY_MODEL.md`.

**Why this stack:** FastAPI and Pydantic provide typed validation, React + TypeScript + Vite power the web UI, and a shared OpenAI-compatible gateway routes model requests. Current persistence remains SQLite while PostgreSQL/pgvector work is pending.

## Privacy: what leaves your computer
With a hosted provider configured, chat messages and matching memories are sent to that provider. File excerpts go only if you select them, after redaction, and after you confirm in a dialog. Camera video stays in the browser. Demo mode sends no model requests.

## Setup
Prerequisites: Python 3.11+, Node 20+ (tested on Python 3.12, Node 22).

```bash
cp .env.example .env            # set provider, API key, and model IDs (or choose LLM_PROVIDER=demo)
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app_factory --factory --reload     # http://127.0.0.1:8000/api/docs
# new terminal
cd frontend && npm install && npm run dev            # http://localhost:5173
```
Or run both with `scripts/dev.sh` after installing each. Never commit `.env`.

**Environment variables:** `LLM_PROVIDER` (`nebius`, `nvidia`, or `demo`), provider keys/URLs, `MODEL_PLANNER`, `MODEL_FAST`, `MODEL_EMBED`, `ORBIT_EMBEDDING_DIMENSION`, `ORBIT_DEMO_MODE`, `ORBIT_MOCK_AI`, `ORBIT_DATABASE_URL`, and security limits. Copy `.env.example`; use `python scripts/list_models.py` to inspect model IDs before setting model variables. The configured values in this example are placeholders, not verified model recommendations.

**Tests:** see `docs/TESTING.md` (`pytest -q`, `ruff check`, `npm run typecheck`, `npm test`, `npm run build`).

**Trying the workspace features safely:** authorize `examples/example-project` in Projects.

## Troubleshooting
- *"Backend not reachable":* start uvicorn on port 8000 (the Vite dev server proxies `/api`).
- *Setup banner in chat:* no key and no demo mode set; edit `.env` and restart the backend.
- *`model_not_configured` or `provider_model_not_found`:* set model IDs for the selected provider using the IDs returned by `python scripts/list_models.py`.
- *`provider_empty_response`:* Nemotron on Token Factory is a reasoning model and can spend its budget thinking; retry.
- *3D view blank:* WebGL is unavailable or disabled in the browser.
- *Camera blocked:* allow it in the browser's site settings; it needs `localhost` or HTTPS.
- *`workspace_too_broad`:* choose a project folder, not `/`, your home folder, or a top-level system folder.

## Limitations
Single user, no authentication on the local API yet (SEC-01). Redaction is pattern-based and incomplete. The model cannot call tools in this version. Camera recognition does not exist. Memory retrieval is keyword-based.

## Team and contributing
Chirag: AI agent, backend architecture, integrations, security. Charanjeet: frontend, UI/UX, visual learning, integration. Work from `TASKS.md`; process in `docs/TEAM_WORKFLOW.md` and `CONTRIBUTING.md`. To add a feature, a skill, or a screen: `docs/EXTENDING.md`, `docs/SKILL_DEVELOPMENT.md`.
