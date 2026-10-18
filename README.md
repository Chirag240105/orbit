# ORBIT: Your Personal AI Operating Layer

One personal agent. Shared memory. Reusable skills. Permission-controlled actions. A structured interface for understanding and acting.

ORBIT is a local-first web app for developers and students who want an AI agent that remembers only what they approve, can read only the folders they authorize, and never changes a file without an explicit approval. It runs **NVIDIA Nemotron** on **Nebius Token Factory**. Built by Chirag (agent, backend, security) and Charanjeet (frontend, UX).

## Three capabilities, one agent
- **A. Chat and skills:** ask, learn a topic (explanation, text diagram, real-world example, interview questions), summarize, plan, explain a file, understand a project. Answers stream in and are validated against a schema; follow-ups keep the conversation's context.
- **B. Workspace agent:** authorize a folder; search and preview files; let ORBIT suggest relevant files, analyze them, **write notes and propose the file**, draft code changes, and suggest project memories. An opt-in **agent mode** lets the model choose its own read-only steps. Every write needs your approval and is verified on disk.
- **C. Visual Learning Studio:** two interactive 3D system scenes with step-by-step learning and AI explanations; show a **printed marker** to the camera and ORBIT opens the matching scene, then steer it with **hand gestures**.

## Feature status (read this first)

| Feature | Status |
|---|---|
| Backend API, Alembic migrations, errors, CORS, local API token, rate limit, audit | **Working**, ~200 automated tests |
| Chat orchestration, 6 chat skills + 3 workflow skills, schema validation with one repair round, streaming (SSE), conversation history, optional model routing | **Working** (tested with demo provider and a scripted fake model) |
| Project agent (read → analyze → draft → propose → remember), AI-drafted changes with secrets kept local, file ranking for questions | **Working**, API and browser tested |
| Agent mode: the model picks its next step (list, search, rank, read, propose, finish), streamed live | **Working, opt-in** (enable in Skills). No write tool, consent before any hosted run, capped steps and reads, every call audited. Tested with a scripted fake model |
| Nebius + Nemotron provider | **Implemented, live reply not yet verified.** Needs your key; confirm the model ID with `scripts/list_models.py` (default `nvidia/Nemotron-3-Nano-30B-A3B`). Live tests are ready (`docs/TESTING.md`) |
| Demo mode (`ORBIT_DEMO_MODE=true`) | **Mocked on purpose**: deterministic, labeled "Demo", no model call |
| Memory (add, edit, search, filter, bulk confirm, delete all; vetted suggestions) | **Working** (stemmed keyword retrieval; evaluated in `docs/MEMORY_DESIGN.md`) |
| Workspace policy, race-safe verified writes, proposal and approval flow | **Working**, unit, API, Linux race and browser tested |
| Secret redaction, consent before workspace data is sent | **Working**, best-effort redaction |
| All screens | **Working and checked in a real browser** (Edge): 26 automated browser checks, no horizontal scroll at 360/768/1280 px. Not yet tried on phones or with a screen reader |
| Light and dark themes, collapsible sidebar | **Working**: System, Light or Dark from the header; all text meets WCAG AA in both themes. The sidebar collapses to an icon rail (the AI Workspace starts collapsed) |
| 3D scenes, camera, printed-marker recognition | **Working in Edge** (WebGL, fake camera with a marker video). Not yet tried with a physical webcam |
| Gesture control (MediaPipe) | **Working in the browser**: pinch-drag rotates, two fingers zoom, open palm resets. Runtime and model are served locally (`npm run setup:vision`, run by `scripts/dev.py`). Not yet tried with a physical webcam |
| Desktop packaging (Tauri), Docker | **Not built**; ORBIT ships as a local web app (`docs/DEPLOYMENT.md`) |
| Unrestricted model tool loop | **Deliberately not built**: the default agent is a fixed pipeline with approval gates, and agent mode is read-only (`docs/AI_AGENT_DESIGN.md`) |

## Architecture
React frontend → Vite dev proxy (adds the local API token) → FastAPI backend (127.0.0.1) → SQLite. The backend owns the API key, the file policy, memory, and the model call. See `docs/ARCHITECTURE.md`, `docs/DATA_FLOW.md`, `docs/THREAT_MODEL.md`, `docs/SECURITY_MODEL.md`.

**Why this stack:** FastAPI and Pydantic give typed validation with little code; SQLite needs no server; React + TypeScript + Vite is quick for two people; React Three Fiber fits the 3D scenes. No vector DB, Redis, or microservices because nothing needs them yet.

## Privacy: what leaves your computer
With a provider configured, your chat messages, recent turns of the conversation, and matching confirmed memories go to the hosted model (Nebius). File excerpts and the project layout go only when a skill needs them, after redaction, and after you confirm in a dialog. Indexing, search, file ranking, permissions, diffs and the database stay local. Camera video, marker recognition and hand tracking stay in the browser. Demo mode sends nothing. ORBIT is **not** fully local while hosted inference is on. Details: `docs/DATA_FLOW.md`.

## Setup
Prerequisites: Python 3.11+, Node 20+. Verified on Windows 11 (Python 3.11, Node 24, Edge) and Ubuntu via WSL (Python 3.14, backend suite). CI runs Python 3.12 and Node 22.

```bash
python scripts/dev.py          # installs what is missing, creates .env, starts backend :8000 and frontend :5173
python scripts/dev.py --demo   # try it without a key (labeled demo output)
```
Then open http://localhost:5173. Put `NEBIUS_API_KEY=...` in `.env` for real answers. Never commit `.env`.

Manual setup instead: `cp .env.example .env`; `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]" && uvicorn app.main:app_factory --factory --reload`; in another terminal `cd frontend && npm install && npm run dev`.

**Environment variables:** `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, `NEBIUS_MODEL`, `NEBIUS_MAX_TOKENS`, `ORBIT_DEMO_MODE`, `ORBIT_MODEL_ROUTING`, `ORBIT_REPAIR_RETRIES`, `ORBIT_DATABASE_URL`, `ORBIT_ALLOWED_ORIGINS`, `ORBIT_MAX_FILE_BYTES`, `ORBIT_CHAT_RATE_LIMIT`, `ORBIT_API_TOKEN`, `ORBIT_TOKEN_FILE`. Details in `.env.example`.

**Tests:** `docs/TESTING.md` (backend `pytest`, frontend `npm test` with ~95 tests, browser `npm run e2e`, live-model tests).

**Trying the workspace features safely:** authorize a copy of `examples/example-project` in Projects (the agent can write into it once you allow writes).

## Documentation
Overview `docs/PROJECT_OVERVIEW.md` · Architecture `docs/ARCHITECTURE.md` · Data flow `docs/DATA_FLOW.md` · API `docs/API_REFERENCE.md` · Agent `docs/AI_AGENT_DESIGN.md` · Memory `docs/MEMORY_DESIGN.md` · Database `docs/DATABASE_SCHEMA.md` · Security `docs/SECURITY_MODEL.md`, `docs/THREAT_MODEL.md` · Workspace `docs/WORKSPACE_ACCESS.md` · Visual learning `docs/VISUAL_LEARNING.md` · UI `docs/UI_UX_GUIDE.md` · Deployment `docs/DEPLOYMENT.md` · Troubleshooting `docs/TROUBLESHOOTING.md` · Testing `docs/TESTING.md` · Demo `docs/DEMO_SCRIPT.md` · Extending `docs/EXTENDING.md`, `docs/SKILL_DEVELOPMENT.md`.

## Limitations
Single user, local only. Redaction is pattern-based and incomplete. A live Nemotron reply has not been verified yet. Camera features have only been tested with a simulated camera. Marker recognition only knows ORBIT's printed markers. Memory retrieval is keyword-based. The Windows write path narrows, but does not close, the check-then-write race (Linux/macOS close it).

## Team and contributing
Chirag: AI agent, backend architecture, integrations, security. Charanjeet: frontend, UI/UX, visual learning, integration. Work from `TASKS.md`; process in `docs/TEAM_WORKFLOW.md` and `CONTRIBUTING.md`.
