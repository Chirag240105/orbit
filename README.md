# ORBIT: Your Personal AI Operating Layer

One personal agent. Shared memory. Reusable skills. Permission-controlled actions. A structured interface for understanding and acting.

ORBIT is a persistent, multimodal personal AI for developers and students. It remembers approved work context, helps plan tasks, explains authorized code, and prepares actions for explicit approval. Built for the NVIDIA x Nebius Personal AI hackathon track by Chirag (agent, backend, security) and Charanjeet (frontend, UX).

## Three capabilities
- **A. Chat and skills:** natural-language requests routed to reusable skills with validated structured output and user-approved memory.
- **B. Vision:** browser-only hand tracking controls a curated 3D scene; pinching remembers the selected component as project-linked memory.
- **C. Workspace intelligence:** authorize a folder, then list, search, preview and explain files; propose changes that need approval.

## Feature status (read this first)

| Feature | Status |
|---|---|
| Backend API, error handling, CORS, chat/auth rate limits, audit | **Verified:** 88 tests passed, 2 skipped; Ruff passes. A fresh SQLite startup migration and `/health`, authenticated `/api/memory`, and `/api/schedule?date=today` smoke checks also passed. Two platform-dependent tests are skipped. |
| PostgreSQL + pgvector schema, Alembic migration, JWT auth and user scoping | **Implemented; SQLite migration matches current SQLAlchemy metadata and startup migration is tested. PostgreSQL runtime not verified here.** |
| Chat orchestration, skill registry (4 skills), schema-validated output | **Working** (tested with demo provider and mocked HTTP) |
| Nebius and NVIDIA OpenAI-compatible gateway | **Gateway implemented; live calls unverified.** Choose task model IDs with `scripts/list_models.py`; needs a provider key |
| Demo mode (`LLM_PROVIDER=demo`, `ORBIT_DEMO_MODE=true`, or `ORBIT_MOCK_AI=true`) | **Deterministic placeholder**: labeled "Demo", no model call |
| Memory (typed records, embeddings, importance/recency ranking, dedupe, confirmation and deletion) | **Implemented; provider embeddings and local fallback need live verification. Demo retrieval uses keyword matching.** |
| Agent intent routing and tools | **Implemented**: six intent labels; validated task, note, memory, code, vision, and schedule tools; reads are audited, writes require approval by default; max three model tool rounds. |
| Day scheduling | **Implemented**: natural-language extraction, timezone-aware deterministic packing, fixed-event conflict and deadline overflow reporting, rationale, and approval-gated task/block saves. Planner provider path is not live-verified; demo extraction is heuristic. |
| Developer intelligence | **Implemented**: selection/file/project/flow explanations, existing workspace exclusions, redaction, hosted-send confirmation, map-reduce, and unconfirmed project-summary memory. Added a predictable FastAPI trace demo repo. Live model quality is unverified. |
| VS Code extension | **Packaged** at vscode-extension/orbit-personal-ai-0.1.0.vsix; TypeScript compile and VSIX packaging pass. Not yet installed or manually exercised in VS Code. |
| Streaming chat and decision UI | **Implemented**: authenticated WebSocket event stream (POST `/api/chat` remains available), memory chips, action approval cards, answer rationale, and per-user debug turns. Live provider streaming not verified. |
| Workspace policy, read-only inspection, proposal and approval flow | **Working**, unit and API tested |
| Secret redaction, consent before external send | **Working**, best-effort redaction |
| All 8 main screens | **Build, typecheck, and 15 frontend tests pass.** All eight route URLs returned the app shell over HTTP; screen rendering and interaction have not yet been reviewed in a real browser. |
| 3D scene and camera panel | **Implemented** with an architecture scene and transparent cursor overlay. WebGL and camera behavior are not manually verified. |
| MediaPipe hand gestures (point, pinch, open hand, swipe) | **Classifier and coordinate mapping are unit tested with recorded landmarks.** Camera fallback below 20 FPS is implemented; real-device frame rate and gesture behavior are unverified. |
| Alembic migrations | **Current SQLite schema matches model metadata;** startup upgrades pending revisions and fails clearly if migration fails. PostgreSQL runtime not verified here. |
| Container deployment and submission feedback assets | **Prepared**; public deployment, managed PostgreSQL, seeded account, and HTTPS URL still need deployment credentials and verification (see [`docs/SUBMISSION.md`](docs/SUBMISSION.md)) |

## Architecture
React frontend → JWT-authenticated FastAPI backend → PostgreSQL/pgvector and the model gateway. The backend owns provider keys, file policy, memory, and model calls. See `docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`, `docs/SECURITY_MODEL.md`.

**Why this stack:** FastAPI and Pydantic provide typed validation, React + TypeScript + Vite power the web UI, PostgreSQL/pgvector store user-scoped work context, and a shared OpenAI-compatible gateway routes model requests.

## Privacy: what leaves your computer
With a hosted provider configured, chat messages and matching memories are sent to that provider. File excerpts go only if you select them, after redaction, and after you confirm in a dialog. Camera video is processed in the browser and is never uploaded; MediaPipe's runtime/model files are fetched from Google/CDN hosts and its documented usage metrics may be sent. Demo mode sends no model requests.

## Setup
Prerequisites: Python 3.11+, Node 20+ (tested on Python 3.12, Node 22).

```bash
cp .env.example .env            # set provider, API key, and model IDs (or choose LLM_PROVIDER=demo)
docker compose up -d db         # local PostgreSQL + pgvector
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app_factory --factory --reload     # http://127.0.0.1:8000/api/docs
# new terminal
cd frontend && npm install && npm run dev            # http://localhost:5173
```
Or run both with `scripts/dev.sh` after installing each. Never commit `.env`.

**Environment variables:** `LLM_PROVIDER` (`nebius`, `nvidia`, or `demo`), provider keys/URLs, `MODEL_PLANNER`, `MODEL_FAST`, `MODEL_EMBED`, `ORBIT_EMBEDDING_DIMENSION`, `ORBIT_DEMO_MODE`, `ORBIT_MOCK_AI`, `ORBIT_DATABASE_URL`, and security limits. Copy `.env.example`; use `python scripts/list_models.py` to inspect model IDs before setting model variables. The configured values in this example are placeholders, not verified model recommendations.

## Deployment packaging

`backend/Dockerfile` runs migrations and FastAPI; `frontend/Dockerfile` builds and serves the web app through Nginx, which proxies API and WebSocket requests. `docker-compose.app.yml` runs both containers against an external managed PostgreSQL database. Set `NEBIUS_API_KEY`, all three model IDs, a stable `ORBIT_JWT_SECRET`, `ORBIT_DATABASE_URL`, and the exact public `ORBIT_ALLOWED_ORIGINS`; keep secrets in the hosting platform's secret manager. Use a managed PostgreSQL service with pgvector and HTTPS ingress. See [`docs/SUBMISSION.md`](docs/SUBMISSION.md) for the architecture, model roles, deployment steps, and current submission status. The compose definition is packaging only: this repository does not claim a live public URL.

After deployment, a reviewer account can be created and populated with synthetic examples by running `python scripts/seed_demo.py` with `ORBIT_API_BASE_URL`, `ORBIT_DEMO_EMAIL`, and `ORBIT_DEMO_PASSWORD` set. The script creates or logs into that account and adds sample memories and tasks idempotently. Share its credentials through the submission channel; do not commit them.

Create an account on the ORBIT sign-in screen. Set a stable random `ORBIT_JWT_SECRET` for a deployment; if omitted, the backend generates a process-local secret, so sessions expire when it restarts.

**Tests:** see `docs/TESTING.md` (`pytest -q`, `ruff check`, `npm run typecheck`, `npm test`, `npm run build`).

**Trying the workspace features safely:** authorize `examples/example-project` in Projects.

**VS Code extension:** install vscode-extension/orbit-personal-ai-0.1.0.vsix, authorize a matching workspace in ORBIT Projects, link its workspace ID in VS Code, and set the ORBIT access token. Hosted sharing is off by default and asks before each send.

## Troubleshooting
- *"Backend not reachable":* start uvicorn on port 8000 (the Vite dev server proxies `/api`).
- *Setup banner in chat:* no key and no demo mode set; edit `.env` and restart the backend.
- *`model_not_configured` or `provider_model_not_found`:* set model IDs for the selected provider using the IDs returned by `python scripts/list_models.py`.
- *`provider_empty_response`:* Nemotron on Token Factory is a reasoning model and can spend its budget thinking; retry.
- *SQLite `no such column: memories.project_id` or `no such table: schedule_blocks`:* stop the backend and back up the database if it contains data you need. Set `ORBIT_DATABASE_URL` to a SQLite file under `backend/`, set `ORBIT_DEMO_EMAIL` and `ORBIT_DEMO_PASSWORD` (at least 12 characters), then run `backend\.venv\Scripts\python.exe scripts\reset_dev_db.py` from the repository root. Add `--yes` to skip the deletion prompt. This permanently deletes that configured SQLite file and its WAL sidecars, then migrates and seeds it. For an Alembic-managed database that should retain data, run `python -m app.db.migrate` from `backend/` instead.
- *3D view blank:* WebGL is unavailable or disabled in the browser.
- *Camera blocked:* allow it in the browser's site settings; it needs `localhost` or HTTPS.
- *`workspace_too_broad`:* choose a project folder, not `/`, your home folder, or a top-level system folder.

## Limitations
Account registration/login and user-scoped records are implemented. Set a stable random ORBIT_JWT_SECRET for deployments; without it, the backend generates a process-local secret and existing login tokens expire when it restarts. Redaction is pattern-based and incomplete. Schedule duration extraction, code explanations, and rationale quality depend on the configured model and have not been verified with a live provider. Trusted tool permissions are stored in the database until turned off. The extension package has not been installed in a real VS Code instance. Gesture frame rate has not been measured on target devices. Demo memory retrieval uses keyword matching.

## Team and contributing
Chirag: AI agent, backend architecture, integrations, security. Charanjeet: frontend, UI/UX, visual learning, integration. Work from `TASKS.md`; process in `docs/TEAM_WORKFLOW.md` and `CONTRIBUTING.md`. To add a feature, a skill, or a screen: `docs/EXTENDING.md`, `docs/SKILL_DEVELOPMENT.md`.
