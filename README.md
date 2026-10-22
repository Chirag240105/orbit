# ORBIT — Your Personal AI Operating Layer

**A private workspace for asking questions, organizing work, and learning how a project fits together.**

ORBIT combines a chat assistant, user-controlled memory, task planning, protected local workspace tools, and a browser-based 3D learning scene. The backend keeps provider credentials and enforces account and workspace boundaries. When a hosted model is configured, ORBIT sends the request context needed for that task; file excerpts require redaction and explicit consent. Camera frames stay in the browser.

ORBIT is intended for developers and students who want one place to work with project context, plan tasks, and explore software concepts. The repository was built for the NVIDIA x Nebius Personal AI hackathon track. It is a local development project; no public deployment is claimed.

## Contents

- [What works today](#what-works-today)
- [Features and user journey](#features-and-user-journey)
- [Screenshots and demo](#screenshots-and-demo)
- [Technology](#technology)
- [Architecture and request flows](#architecture-and-request-flows)
- [Repository map](#repository-map)
- [Run ORBIT locally](#run-orbit-locally)
- [Configuration reference](#configuration-reference)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Security and privacy](#security-and-privacy)
- [Tests and quality checks](#tests-and-quality-checks)
- [Container packaging](#container-packaging)
- [Limitations and roadmap](#limitations-and-roadmap)
- [Contributing](#contributing)
- [License and credits](#license-and-credits)

## What works today

This table separates automated or local verification from features that still need a real provider, browser, or deployment environment.

| Area | Current status |
|---|---|
| Backend API, auth, error handling, CORS, rate limits, audit | **Verified locally:** 91 backend tests passed, 2 skipped; Ruff passed. Fresh SQLite migration and smoke requests to `/health`, authenticated `/api/memory`, and `/api/schedule?date=today` passed. |
| Frontend | **Verified:** TypeScript typecheck, 24 frontend tests, and production build passed. Route-based code splitting reduces initial load from 1.3 MB to ~249 kB (78 kB gzip); Three.js and MediaPipe load only when Visual Learning is opened. All eight route URLs returned the app shell over HTTP. Browser rendering and interaction have not been reviewed manually. |
| Database migrations | Alembic startup migration and SQLite metadata comparison are tested. PostgreSQL runtime has not been verified in this environment. |
| Chat, built-in skills, scheduling, memory, workspace policy | Implemented and covered by tests using demo behavior or mocked provider calls. Hosted model output quality is not verified. |
| Nebius and NVIDIA model gateway | Implemented. Live credentials, model IDs, and generation calls are not verified. Model IDs are intentionally configured by the user. |
| Visual Learning scene and gestures | Scene, gesture classifier, and coordinate mapping are implemented; gesture unit tests pass. WebGL, camera permission, frame rate, and physical-device behavior are unverified. |
| VS Code extension | A VSIX package is present. It has not been installed or manually exercised in VS Code. |
| Deployment | Dockerfiles and compose packaging exist. No live deployment URL, managed database, or HTTPS site is available to verify. |

## Features and user journey

### Chat and reusable skills

Ask ORBIT a question or choose a task such as summarizing, planning, or explaining. The backend routes the request through its skill registry and validates structured model output. It can use relevant confirmed memories. Demo mode returns clearly labeled deterministic placeholder output without calling a hosted model. Five built-in skills are registered: general Q&A, summarize text, explain code, task planning, and system-design explanation.

### Memory and projects

Save facts and preferences, attach memories to projects, search and edit them, and remove them when no longer useful. Memories are scoped to the signed-in user. Retrieval uses embeddings when available and falls back to keyword matching in demo mode.

### Tasks and daily planning

Create and update tasks directly, or ask ORBIT to draft a day plan around fixed events, task priorities, deadlines, and a timezone. Generated task and schedule changes are presented as pending actions for approval before they are saved.

### Local workspace intelligence

Authorize a folder, browse its filtered file tree, search, preview files, and request code explanations. Workspace access is constrained by a path policy. If file content would be sent to a hosted provider, ORBIT redacts known secret patterns and asks for confirmation. Proposed file changes are not written until approved; approval checks the workspace write setting and the file's base hash.

### Visual Learning Studio

Explore curated, hand-built 3D architecture scenes. Mouse controls work without a camera. Optional browser hand tracking recognizes point, pinch-to-grab (rotate the scene), open hand, and swipe gestures; remembering a selected component posts a `VISION` memory linked to a project name. Camera frames are processed locally and are not uploaded. The hand-tracking runtime and model are downloaded from external hosts when enabled.

The studio includes a curated **Amazon-like e-commerce system-design** scene with 11 components (CDN, API Gateway, Product Catalog, Cart, Order, Payment, Inventory, Database, Cache, Message Queue). Selecting a component shows its APIs, data model, scaling strategy, failure modes, and design trade-offs. A collapsible system-design overview panel covers requirements, assumptions, high-level architecture, and the request flow. Ask in chat with "Explain the system design of Amazon" to get a structured interview-style breakdown from the AI.

The hand-tracking model includes an improved FPS monitoring system: inference runs at up to ~30 FPS, with a 5-second warm-up and an 8 FPS stop threshold (four consecutive 2-second low-FPS windows) before falling back to mouse/keyboard controls. Pinch-to-grab lets you rotate the 3D scene by pinching and moving your hand.

### Main screens

The React application provides Home, AI Workspace, Projects, Visual Learning, Memory, Skills, Tasks and Plans, and Settings and Privacy. Route URLs are `/`, `/chat`, `/projects`, `/visual`, `/memory`, `/skills`, `/tasks`, and `/settings`.

## Screenshots and demo

There are no checked-in screenshots or verified hosted demo links. To capture useful screenshots later, save reviewed images under `docs/screenshots/` and add only screenshots taken from the running application.

A safe first journey is:

1. Start in demo mode and create an account.
2. Open Visual Learning, select a scene component, and save it to Memory.
3. Open Projects and authorize `examples/example-project` to explore local workspace features.
4. Try chat and task planning. Demo responses are deterministic placeholders and are labeled as such.

## Technology

| Area | Technology | Role in ORBIT |
|---|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, TanStack Query | Screens, routing, API state, and development/build server. |
| 3D and vision | Three.js, `@react-three/fiber`, Drei, MediaPipe Tasks Vision | Interactive curated 3D scene and optional in-browser hand landmarks. |
| Backend | Python 3.11+, FastAPI, Pydantic 2, Uvicorn | Typed HTTP/WebSocket API, validation, and application lifecycle. Python 3.12 is used by the backend container. |
| Persistence | SQLAlchemy 2, Alembic, PostgreSQL, pgvector | User-scoped records, versioned schema, and vector-capable memory embeddings. SQLite is used in tests and can be used for local development. |
| Model integrations | OpenAI-compatible HTTP API for Nebius or NVIDIA; optional Sentence Transformers fallback | Chat/generation and embeddings. The app does not hard-code model IDs or keys. |
| Authentication and security | HS256 bearer tokens, bcrypt password hashes, CORS allowlist, rate limiters, audit records, workspace policy, secret redaction | Account access, request protections, and constrained local file operations. |
| Packaging | Docker, Docker Compose, Nginx | Backend/frontend images and a separate local PostgreSQL service. Deployment is not hosted by this repository. |
| Editor integration | VS Code extension API | Optional extension source and packaged VSIX under `vscode-extension/`. |

## Architecture and request flows

### System architecture

```mermaid
flowchart LR
    U[User] --> FE[React and TypeScript app]
    FE -->|Bearer token, HTTP or WebSocket| API[FastAPI API]
    API --> AUTH[Authentication and rate limits]
    AUTH --> ORCH[Agent and domain services]
    ORCH --> DB[(PostgreSQL with pgvector)]
    ORCH --> POLICY[Workspace policy and file services]
    POLICY --> FS[User-authorized local folders]
    ORCH --> SKILLS[Skills, memory, tasks and schedule]
    ORCH --> GW[Model gateway]
    GW -->|Configured provider and model| LLM[Nebius or NVIDIA API]
    FE -->|Camera frames stay in browser| VISION[MediaPipe and 3D scene]
    VISION -->|Explicit Remember action| API
```

The frontend does not call model providers directly. Provider keys remain in the backend environment. The frontend's Vite development server proxies `/api` to port 8000; the production Nginx config proxies API and WebSocket traffic to the backend service.

### Chat request lifecycle

```mermaid
sequenceDiagram
    actor User
    participant UI as React app
    participant API as FastAPI
    participant Agent as Agent and skills
    participant DB as SQL database
    participant Model as Configured model gateway
    User->>UI: Submit a message
    UI->>API: POST /api/chat with bearer token
    API->>API: Authenticate, rate-limit, validate request
    API->>Agent: Route to skill and check permissions
    Agent->>DB: Load confirmed relevant memories
    opt User selected workspace files
        Agent->>Agent: Enforce workspace policy, redact and cap excerpts
        Agent-->>UI: Return consent_required preview if hosted send lacks consent
        UI->>User: Ask whether to send the selected excerpts
    end
    Agent->>Model: Send prompt when provider is configured
    Model-->>Agent: Return model text and provider metadata
    Agent->>Agent: Parse and validate structured output
    Agent->>DB: Save conversation and metadata; audit external file sends
    Agent-->>API: Validated response
    API-->>UI: JSON response
```

With `LLM_PROVIDER=demo`, the gateway uses deterministic local placeholder output rather than a model API. The WebSocket endpoint streams token and status events for configured hosted providers and sends a final validated result.

### Authentication flow

```mermaid
sequenceDiagram
    actor User
    participant UI as React app
    participant Auth as /api/auth
    participant DB as SQL database
    User->>UI: Register or sign in
    UI->>Auth: POST /register or /login
    Auth->>DB: Create account or verify password hash
    Auth-->>UI: Short-lived HS256 bearer token
    UI->>UI: Keep token for API calls
    UI->>Auth: Protected request with Authorization: Bearer token
    Auth->>Auth: Verify signature and expiry; scope DB session to user
    Auth-->>UI: User-scoped response
    User->>UI: Sign out
    UI->>UI: Remove locally stored token
```

Registration and login are throttled. Tokens are signed with `ORBIT_JWT_SECRET`, or with a process-generated secret if none is configured. In the latter case, sessions stop working after a backend restart. Sign out removes the browser token; there is no server-side token revocation endpoint.

## Repository map

```text
orbit-personal-ai/
├── backend/
│   ├── app/
│   │   ├── api/             # Domain routers and router composition
│   │   ├── agent/           # Chat orchestration and intent handling
│   │   ├── audit/           # Audit event recording
│   │   ├── core/            # Error handlers and rate limiting
│   │   ├── db/              # SQLAlchemy session and migration helper
│   │   ├── memory/          # Memory storage and retrieval
│   │   ├── models.py        # SQLAlchemy entities
│   │   ├── providers/       # Provider interface and gateway selection
│   │   ├── schedule/        # Day scheduling and approval drafts
│   │   ├── security/        # Secret redaction
│   │   ├── services/        # Model gateway
│   │   ├── skills/          # Skill schemas, built-ins, and registry
│   │   ├── tools/           # Allowlisted user and agent tools
│   │   └── workspace/       # Path policy, file service, code explanations
│   ├── migrations/          # Alembic environment and revisions
│   ├── tests/               # API, service, migration, and security tests
│   ├── alembic.ini
│   ├── Dockerfile
│   └── pyproject.toml       # Python dependencies and pytest/Ruff config
├── frontend/
│   ├── src/app/             # Shell and active workspace state
│   ├── src/components/      # Shared UI primitives
│   ├── src/features/        # Home, chat, projects, memory, tasks, etc.
│   ├── src/lib/             # API client and formatting helpers
│   ├── src/vision/          # 3D scene, camera panel, and gestures
│   ├── tests/               # UI and gesture unit tests
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json         # Frontend scripts and dependencies
├── vscode-extension/        # Extension source, manifest, and packaged VSIX
├── scripts/                 # Dev, model-list, database-reset, and demo tools
│   └── demo_repo/           # Small example repository for workspace features
├── examples/                # Example project and example skill
├── docs/                    # Architecture, API, security, testing, and guides
├── .env.example             # Safe configuration template; copy to .env
├── docker-compose.yml       # Local PostgreSQL/pgvector service
├── docker-compose.app.yml   # Backend/frontend app packaging for external DB
├── TASKS.md                 # Project task board and acceptance criteria
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

`backend/app/main.py` creates the FastAPI app and wires database migration, middleware, routers, and WebSocket chat. `frontend/src/main.tsx` mounts the React routes. `backend/app/models.py` defines persisted entities; `backend/app/schemas.py` defines API validation and response schemas.

## Run ORBIT locally

### Prerequisites

- Python 3.11 or newer (Python 3.12 is used in the backend Docker image).
- Node.js 20 or newer and npm (Node 22 is used in the frontend Docker image).
- Docker Compose only if you want the PostgreSQL/pgvector development database.
- A model provider key and model IDs only if you want hosted model calls. Demo mode needs no provider key.

### 1. Configure the environment

From the repository root, copy the example file. Never commit `.env`.

```bash
cp .env.example .env
```

For a quick local run without Docker or provider credentials, set these values in `.env`:

```dotenv
LLM_PROVIDER=demo
ORBIT_DEMO_MODE=true
ORBIT_DATABASE_URL=sqlite:///./orbit-dev.db
```

SQLite is suitable for local development and tests. For PostgreSQL, keep the example database URL and start the included database in the next step. For hosted model calls, choose `nebius` or `nvidia`, set its API key, and select model IDs returned by `scripts/list_models.py`.

### 2. Start PostgreSQL when using it

The root compose file starts only PostgreSQL with pgvector, exposed at port 5432. Its development password defaults to `orbit-dev-only`; change it for any shared or non-local use and keep the database URL in sync.

```bash
docker compose up -d db
```

Skip this step when using SQLite.

### 3. Install and migrate the backend

```bash
cd backend
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell instead:
# .\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
alembic upgrade head
```

Alembic applies pending revisions automatically when the app starts. The explicit `alembic upgrade head` command is useful for seeing migration errors before starting the server. To migrate an already Alembic-managed database later, run `python -m app.db.migrate` from `backend/`.

### 4. Install and start the frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` to `http://127.0.0.1:8000`.

### 5. Start the backend

In another terminal, from the `backend/` directory with its virtual environment active:

```bash
uvicorn app.main:app_factory --factory --reload --host 127.0.0.1 --port 8000
```

Open [http://127.0.0.1:8000/api/docs](http://127.0.0.1:8000/api/docs) for interactive API documentation. `GET /health` is a liveness endpoint; authenticated `GET /api/health` also checks database and provider reachability.

The repository's `scripts/dev.sh` starts both services on macOS/Linux after dependencies have been installed. On Windows, use the separate terminal commands above.

### First use

Create an account from the sign-in screen. In demo mode, chat and planning return clearly labeled placeholder output. To try workspace tools, authorize `examples/example-project` from the Projects screen. File operations are limited to the authorized folder.

## Configuration reference

The backend reads `.env` from the working directory or its parent. The following are the settings defined by `backend/app/config.py`, `.env.example`, and project scripts. Empty key and model values mean they are unset.

| Variable | Purpose | Required? | Example / default |
|---|---|---:|---|
| `LLM_PROVIDER` | Select `nebius`, `nvidia`, or `demo`. | No | `nebius` in `.env.example`; choose `demo` for no model calls. |
| `NEBIUS_API_KEY` | Nebius Token Factory credential. | For Nebius | `your-nebius-key` |
| `NEBIUS_BASE_URL` | Nebius OpenAI-compatible API root. | No | `https://api.tokenfactory.nebius.com/v1/` |
| `NVIDIA_API_KEY` | NVIDIA API credential. | For NVIDIA | `your-nvidia-key` |
| `NVIDIA_BASE_URL` | NVIDIA OpenAI-compatible API root. | No | `https://integrate.api.nvidia.com/v1` |
| `MODEL_PLANNER` | Model for chat and planning/generation tasks. | For hosted generation | Select a valid ID using `scripts/list_models.py`. Alias `NEBIUS_MODEL` is accepted. |
| `MODEL_FAST` | Optional fast model for short structured tasks. | No | Unset |
| `MODEL_EMBED` | Optional remote embedding model. | No | Unset |
| `ORBIT_EMBEDDING_DIMENSION` | Expected vector size for stored embeddings. | No | `384` |
| `ORBIT_EMBEDDING_FALLBACK_MODEL` | Local Sentence Transformers model used when remote embeddings are unavailable. | No | `.env.example` suggests `sentence-transformers/all-MiniLM-L6-v2`; package install is optional. |
| `ORBIT_DATABASE_URL` | SQLAlchemy connection URL. | No for SQLite; yes for PostgreSQL | `postgresql+psycopg://orbit:orbit-dev-only@localhost:5432/orbit` |
| `ORBIT_JWT_SECRET` | Stable signing secret for bearer tokens. | Recommended; required for stable production sessions | Leave blank only for local use; backend creates a process-only secret. |
| `ORBIT_JWT_LIFETIME_MINUTES` | Bearer token lifetime (5–10,080 minutes). | No | `60` |
| `ORBIT_ALLOWED_ORIGINS` | Comma-separated browser origins allowed by CORS and WebSocket origin checks. | No | `http://localhost:5173,http://127.0.0.1:5173` |
| `ORBIT_DEMO_MODE` | Force deterministic demo responses. | No | `false` |
| `ORBIT_MOCK_AI` | Enable deterministic mocked model behavior. | No | `false` |
| `ORBIT_MAX_FILE_BYTES` | Maximum file size accepted by workspace tools. | No | `200000` |
| `max_context_chars` | Maximum assembled model context characters. | No | `24000` (setting name is lowercase; environment variable is `MAX_CONTEXT_CHARS`). |
| `ORBIT_PROVIDER_TIMEOUT_S` | HTTP timeout for provider calls. | No | `90` |
| `ORBIT_PROVIDER_RETRIES` | Retry count for provider transport failures (0–1). | No | `1` |
| `POSTGRES_PASSWORD` | Password for the local PostgreSQL compose service. | No for local compose | `orbit-dev-only` fallback; change outside isolated local use. |
| `ORBIT_HTTP_PORT` | Host port for the packaged frontend container. | No | `8080` |
| `ORBIT_API_BASE_URL` | Base API URL used by the demo seed script. | For seed script | `http://127.0.0.1:8000` |
| `ORBIT_DEMO_EMAIL` | Account email used by seed/reset scripts. | For seed/reset scripts | `demo@example.test` |
| `ORBIT_DEMO_PASSWORD` | Account password used by seed/reset scripts. | For seed/reset scripts | `replace-with-a-long-local-password` |

The provider URL validator permits HTTPS, or HTTP only for localhost. Do not place credentials in the frontend environment. `.env` is ignored by Git; use a secret manager for deployed services.

## API reference

The interactive OpenAPI page is available at `/api/docs` while the backend runs. Except for `GET /health` and the registration/login endpoints, API routes require `Authorization: Bearer <access_token>`. Error responses use `{"error":{"code":"...","message":"...","details":...}}`; malformed input returns HTTP 422 with `validation_error`.

### Authentication and health

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| `GET` | `/health` | Liveness check. | None |
| `POST` | `/api/auth/register` | Create account and return bearer token. JSON: `email`, `password`. | None; rate limited |
| `POST` | `/api/auth/login` | Verify credentials and return bearer token. JSON: `email`, `password`. | None; rate limited |
| `GET` | `/api/auth/me` | Return current account ID and email. | Bearer token |
| `GET` | `/api/health` | Database and provider reachability status. | Bearer token |
| `GET` | `/api/settings` | Provider state, privacy statements, limits, and available tools. | Bearer token |

### Chat, tools, and history

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| `POST` | `/api/chat` | Run a chat/skill request. JSON: `message`, optional `conversation_id`, `skill`, `workspace_id`, `file_paths` (up to 5), `consent_external` (default false). | Bearer token; 30 requests/minute per client |
| `GET` | `/api/tools` | List agent tool catalog. | Bearer token |
| `GET` | `/api/tool-permissions` | Read write-tool trust settings. | Bearer token |
| `PATCH` | `/api/tool-permissions/{name}` | Change session trust for a writable tool. JSON: `trusted_for_session`. | Bearer token |
| `POST` | `/api/tools/{name}/invoke` | Invoke a named agent tool with a JSON argument object. | Bearer token |
| `GET` | `/api/debug/last-turns` | Read recent in-memory debug summaries for the current user. | Bearer token |
| `GET` | `/api/conversations` | List recent conversations. | Bearer token |
| `GET` | `/api/conversations/{cid}/messages` | List messages in one conversation. | Bearer token |
| `DELETE` | `/api/conversations/{cid}` | Delete one conversation and its messages. | Bearer token |
| `DELETE` | `/api/conversations` | Delete all current user's conversations. | Bearer token |
| `WS` | `/ws/chat` | Stream chat events. First JSON frame contains `token` and `request` (a `ChatRequest`); events include token/status, `done`, or `error`. | Bearer token in first frame; allowed origin |

### Memory, vision, projects, notes, and tasks

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| `GET` | `/api/memories` | List memories; optional `q` substring filter. `/api/memory` is a compatibility alias. | Bearer token |
| `POST` | `/api/memories` | Save memory. JSON: `content`, `type`, optional `source`. Types: `USER`, `PROJECT`, `TASK`, `PREFERENCE`, `DECISION`, `EVENT`, `CODE_CONTEXT`, `VISION`. | Bearer token |
| `PATCH` | `/api/memories/{mid}` | Update `content`, `type`, or `confirmed`. | Bearer token |
| `DELETE` | `/api/memories/{mid}` | Delete one memory. | Bearer token |
| `DELETE` | `/api/memories` | Delete all current user's memories. | Bearer token |
| `POST` | `/api/vision/context` | Save visual context. JSON: `content`, `project_name`; creates the named project if needed. | Bearer token |
| `GET` | `/api/projects` | List projects. | Bearer token |
| `POST` | `/api/projects` | Create project. JSON: `name`, optional `description`. | Bearer token |
| `PATCH` | `/api/projects/{project_id}` | Update project `name` or `description`. | Bearer token |
| `DELETE` | `/api/projects/{project_id}` | Delete project; linked notes and memories are unlinked. | Bearer token |
| `GET` | `/api/notes` | List notes; optional `project_id`. | Bearer token |
| `POST` | `/api/notes` | Create note. JSON: `title`, optional `content`, `project_id`. | Bearer token |
| `PATCH` | `/api/notes/{note_id}` | Update note fields. | Bearer token |
| `DELETE` | `/api/notes/{note_id}` | Delete note. | Bearer token |
| `GET` | `/api/tasks` | List tasks. | Bearer token |
| `POST` | `/api/tasks` | Create task. JSON: `title`, optional `notes`, `status`, `priority`, `due`, `source`. | Bearer token |
| `PATCH` | `/api/tasks/{tid}` | Update task fields. | Bearer token |
| `DELETE` | `/api/tasks/{tid}` | Delete task. | Bearer token |
| `GET` | `/api/schedule` | List schedule blocks for `date` (default `today`) or its alias `day`, with optional `timezone_name` (default `Asia/Calcutta`). | Bearer token |
| `POST` | `/api/schedule/generate` | Draft a day schedule; JSON includes `request`, `date`, optional `timezone`, workday times, fixed events, and tasks. Returns blocks/conflicts and a pending action ID. | Bearer token |

### Workspaces, file changes, actions, and skills

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| `GET` | `/api/workspaces` | List authorized workspace folders. | Bearer token |
| `POST` | `/api/workspaces` | Authorize a local folder. JSON: `path`, optional `name`. | Bearer token |
| `PATCH` | `/api/workspaces/{workspace_id}` | Set `allow_write`. | Bearer token |
| `DELETE` | `/api/workspaces/{workspace_id}` | Remove authorization and pending proposals. | Bearer token |
| `GET` | `/api/workspaces/{workspace_id}/tree` | List allowed files. | Bearer token |
| `GET` | `/api/workspaces/{workspace_id}/summary` | Summarize workspace structure. | Bearer token |
| `GET` | `/api/workspaces/{workspace_id}/search?q=...` | Search authorized files. | Bearer token |
| `GET` | `/api/workspaces/{workspace_id}/file?path=...` | Read a file through workspace policy. | Bearer token |
| `POST` | `/api/code/explain` | Explain selected code/workspace context. Request schema is published in OpenAPI. | Bearer token |
| `POST` | `/api/workspaces/{workspace_id}/changes` | Propose a change. JSON: `path`, `new_content`, optional `description`; does not write the file. | Bearer token |
| `GET` | `/api/changes` | List proposals; optional `status`. | Bearer token |
| `POST` | `/api/changes/{cid}/approve` | Apply a pending proposal if write access and hash checks pass. | Bearer token |
| `POST` | `/api/changes/{cid}/reject` | Reject a pending proposal. | Bearer token |
| `GET` | `/api/actions` | List pending agent actions; optional `status` (default `pending`). | Bearer token |
| `POST` | `/api/actions/{action_id}/approve` | Approve a pending action. | Bearer token |
| `POST` | `/api/actions/{action_id}/reject` | Reject a pending action. | Bearer token |
| `GET` | `/api/skills` | List registered skills and schemas. | Bearer token |
| `PATCH` | `/api/skills/{name}` | Enable or disable a skill. JSON: `enabled`. | Bearer token |

Example: register, save the returned token, then list memories. Replace the local example password before use outside a disposable test account.

```bash
TOKEN=$(curl -s http://127.0.0.1:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.test","password":"replace-this-password"}' | python -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

curl http://127.0.0.1:8000/api/memories \
  -H "Authorization: Bearer $TOKEN"

curl -X POST http://127.0.0.1:8000/api/memories \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"content":"I prefer TypeScript for frontend projects","type":"PREFERENCE"}'
```

The memory request returns HTTP 201 and a memory object containing `id`, `content`, `type`, `source`, `project_id`, `confirmed`, `importance`, `last_accessed`, `created_at`, and `updated_at`. Registration/login return `{"access_token":"…","token_type":"bearer"}`. The bearer token is sent in the `Authorization` header for protected routes.

Common responses include `401 authentication_required` or `invalid_token`, `409 consent_required` when hosted file context needs approval, `404 not_found`, and `422 validation_error`. See `/api/docs` for exact schemas and responses.

## Data model

All user-owned rows carry a user ID. SQLAlchemy session hooks filter ORM reads to the authenticated user and require ownership for new user-scoped records. Alembic revisions manage schema changes.

```mermaid
erDiagram
    USER ||--o{ PROJECT : owns
    USER ||--o{ MEMORY : owns
    PROJECT o|--o{ MEMORY : groups
    USER ||--o{ TASK : owns
    TASK o|--o{ SCHEDULE_BLOCK : schedules
    USER ||--o{ SCHEDULE_BLOCK : owns
    USER ||--o{ CONVERSATION : owns
    CONVERSATION ||--o{ MESSAGE : contains
    USER ||--o{ WORKSPACE : authorizes
    PROJECT o|--o{ WORKSPACE : links
    WORKSPACE ||--o{ PROPOSED_CHANGE : contains
    USER ||--o{ NOTE : owns
    PROJECT o|--o{ NOTE : groups
    USER ||--o{ PENDING_ACTION : reviews
    USER ||--o{ TOOL_PERMISSION : configures
    USER ||--o{ SKILL_SETTING : configures
    USER ||--o{ AUDIT_LOG : generates
```

Persisted entities are `User`, `Project`, `Memory`, `Task`, `ScheduleBlock`, `Conversation`, `Message`, `Workspace`, `ProposedChange`, `Note`, `PendingAction`, `ToolPermission`, `SkillSetting`, and `AuditLog`. Memory stores a type, source, confirmation state, importance/access timestamps, optional project link, and optional embedding. Audit entries store event metadata; file contents are not added to audit records.

## Security and privacy

- Passwords are hashed with bcrypt (after SHA-256 preprocessing); bearer tokens use HS256 and expire according to `ORBIT_JWT_LIFETIME_MINUTES`.
- Protected API routers require a valid bearer token. Database sessions are scoped to the authenticated user. Registration/login and chat have in-memory rate limits.
- CORS and WebSocket origins use an explicit allowlist; wildcard origins are rejected.
- Workspace path resolution and file operations go through workspace policy. New file writes require a proposal, explicit approval, workspace write access, and a successful hash check.
- File text is bounded and pattern-redacted before hosted requests. The user must confirm external sending when selected workspace excerpts are included. Pattern redaction is best effort and cannot detect every secret.
- Model output and retrieved context are treated as untrusted; structured skill output is validated. This does not make model-generated content inherently safe.
- Provider keys belong only in backend environment variables. A process-generated JWT secret is convenient for local use but invalidates sessions on restart; deployments should set a stable random secret.
- Camera video is handled in the browser and is not uploaded. MediaPipe assets load from external hosts when camera tracking starts.

Known gaps: no server-side token revocation, no comprehensive security audit or hosted-provider penetration test, no claim of complete secret detection, and no live model or PostgreSQL operation verified for this checkout.

## Tests and quality checks

Run from the indicated directories:

```bash
cd backend
pytest -q
ruff check app tests

cd ../frontend
npm run typecheck
npm test
npm run build
```

Backend tests use SQLite, mocked HTTP, and temporary folders; they do not require model credentials. Frontend tests use Vitest and jsdom; they do not verify real WebGL or camera behavior. The last recorded local run passed **91 backend tests (2 skipped), Ruff, TypeScript typecheck, 24 frontend tests, and the production build**. Route-based code splitting separates Three.js, MediaPipe, and vendor bundles so they load only when needed. Initial page load is ~249 kB (78 kB gzip); the Three.js chunk (860 kB / 232 kB gzip) loads only when Visual Learning is opened.

For manual demo checks, use [`docs/TESTING.md`](docs/TESTING.md). Live model calls, physical camera behavior, browser rendering, and PostgreSQL deployment remain manual verification items.

## Container packaging

The repository has two compose files with different purposes:

- `docker-compose.yml` starts only local PostgreSQL/pgvector for development.
- `docker-compose.app.yml` builds the backend and frontend containers, serves the frontend through Nginx, and expects an external PostgreSQL connection. It does not provision that managed database or a public HTTPS endpoint.

The app compose file requires `NEBIUS_API_KEY`, `MODEL_PLANNER`, `MODEL_FAST`, `MODEL_EMBED`, `ORBIT_DATABASE_URL`, `ORBIT_JWT_SECRET`, and `ORBIT_ALLOWED_ORIGINS`. Review the file and set these values through a deployment secret manager. The backend container image runs Alembic and then Uvicorn. No live deployment has been tested.

## Limitations and roadmap

- Two curated architecture scenes are supported (three-tier web app, Amazon-like e-commerce) with structured system-design learning content; other subject tabs are planned placeholders.
- A system-design skill is registered on the backend for interview-style architecture explanations via chat.
- Live Nebius/NVIDIA calls, configured model IDs, hosted embedding behavior, and answer quality require separate verification.
- Browser screens, WebGL, and camera performance have not been manually exercised across devices.
- Demo mode is intentionally deterministic; memory retrieval in demo mode uses keyword matching.
- Workspace redaction is pattern-based, and the app does not guarantee complete secret removal.
- The packaged VS Code extension has not been tested in a real editor.
- Database startup migrates Alembic-managed databases. A legacy SQLite file created before Alembic may need the documented reset procedure.
- `TASKS.md` tracks additional project work; do not interpret every task as implemented.

See [`TASKS.md`](TASKS.md), [`docs/GAP_ANALYSIS.md`](docs/GAP_ANALYSIS.md), and [`docs/SUBMISSION.md`](docs/SUBMISSION.md) for project tasks, gaps, and deployment/submission notes.

## Troubleshooting

- **Backend not reachable:** start Uvicorn on port 8000. Vite proxies API requests to that port.
- **Chat setup banner:** select demo mode or configure the provider key and model IDs, then restart the backend.
- **`model_not_configured` / `provider_model_not_found`:** set model IDs supported by the selected provider; use `scripts/list_models.py` to inspect the provider catalogue.
- **`provider_empty_response`:** the provider returned no visible text; retry or review model/token settings.
- **SQLite `table users already exists`, `no such column: memories.project_id`, or `no such table: schedule_blocks`:** this usually means the SQLite file was created before Alembic managed its schema, or a previous first migration stopped partway through. To keep the old file untouched, stop the backend and change `ORBIT_DATABASE_URL` in `.env` to a new SQLite filename, for example `sqlite:///./orbit-clean.db`; startup will create and migrate it. The path is relative to the backend working directory. The old database remains available for recovery. If you intend to reset and reseed instead, back up any data you need, set `ORBIT_DEMO_EMAIL` and `ORBIT_DEMO_PASSWORD` (at least 12 characters), then from the repository root run `backend\.venv\Scripts\python.exe scripts\reset_dev_db.py`. The reset deletes the configured database and WAL sidecars. Add `--yes` to skip its confirmation. For an Alembic-managed database you need to preserve, run `python -m app.db.migrate` from `backend/` instead.
- **3D view is blank:** WebGL may be unavailable or disabled. Use the component list and mouse controls where possible.
- **Camera unavailable:** camera access requires browser permission and a secure context such as `localhost` or HTTPS. Mouse/keyboard controls remain available.
- **Hand tracking stopped ("below 8 FPS"):** the system waits 5 seconds for warm-up, then requires four consecutive 2-second windows below 8 FPS before stopping. A temporary dip won't terminate a usable session. If tracking stops, click "Try camera again" or use mouse/keyboard controls. Lower the camera resolution in `CameraPanel.tsx` if your device is slow.
- **Pinch-to-grab not rotating the scene:** make sure your hand is visible to the camera and pinch firmly. The pinch maps to scene rotation while held. The mouse drag always works as an alternative.
- **`workspace_too_broad`:** authorize a project folder rather than a filesystem root, home folder, or system directory.

## Contributing

1. Choose an item from `TASKS.md` and follow its acceptance criteria.
2. Create a branch named `feat/<task-id>-short-name`.
3. Before a pull request, run backend pytest/Ruff and frontend typecheck/tests/build (commands above).
4. Add failure-case tests for security-sensitive changes to workspace policy, tools, redaction, or agent behavior.
5. Never commit `.env`, credentials, local databases, or personal files. Do not use real credentials in tests.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/TEAM_WORKFLOW.md`](docs/TEAM_WORKFLOW.md) for project conventions.

## License and credits

This project is licensed under the [MIT License](LICENSE). The project README credits Chirag for agent, backend, and security work, and Charanjeet for frontend, UX, and visual learning. Provider names and libraries are acknowledged here as integration dependencies; ORBIT does not claim affiliation with their maintainers.
