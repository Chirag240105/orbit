# ORBIT backend

FastAPI + SQLAlchemy + Pydantic. Runs on `127.0.0.1:8000`; PostgreSQL with
pgvector is the configured datastore. Alembic manages the schema; production
tables are not created automatically at startup. Tests use in-memory SQLite.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp ../.env.example ../.env          # then edit
cd .. && docker compose up -d db
cd backend && alembic upgrade head
uvicorn app.main:app_factory --factory --reload
pytest -q && ruff check app tests
```
API docs (when running): http://127.0.0.1:8000/api/docs

Startup applies pending Alembic revisions and fails with the migration error if the schema cannot reach the current head. For an existing SQLite database without Alembic history, back up needed data and use the root README troubleshooting instructions for `scripts/reset_dev_db.py`; it deletes the configured SQLite file before recreating and seeding it. For an Alembic-managed database, run `python -m app.db.migrate` from `backend/` to upgrade without resetting data.

## Model gateway

Set `LLM_PROVIDER=nebius` or `nvidia`, the matching API key, and task model IDs
(`MODEL_PLANNER`, `MODEL_FAST`, optionally `MODEL_EMBED`) in the repository
`.env`. `MODEL_PLANNER` is used for chat and long-form work; `MODEL_FAST` is
available for routing and short structured tasks. Run `python scripts/list_models.py`
from the repository root to list IDs exposed by the
active provider, then choose IDs supported by that provider. No model IDs or
keys are built into the application. `LLM_PROVIDER=demo`, `ORBIT_DEMO_MODE`, or
`ORBIT_MOCK_AI` enables deterministic UI/test responses.

When a remote embedding model is not configured or returns a vector with a
dimension different from `ORBIT_EMBEDDING_DIMENSION`, the gateway can use the
local Sentence Transformers fallback. Install it with `pip install -e
".[embeddings]"`; set `ORBIT_EMBEDDING_FALLBACK_MODEL` and its output dimension
to match. `/api/health` reports the configured provider and checks its model
catalogue endpoint. This check does not verify that configured model IDs can
complete a generation request.

| Folder | Responsibility | Extension point |
|---|---|---|
| `app/api` | Domain routers (health, chat, projects, memory, code, actions, tasks, schedule, vision, skills) | add a route to its domain module; `routes.py` composes the routers |
| `app/agent` | Orchestration: route skill, check permissions, build prompt, validate output | `orchestrator.py` |
| `app/providers` | Model providers behind `ChatProvider` | subclass + `build_provider` |
| `app/skills` | Skill base, built-ins, registry | add a `Skill`, register it |
| `app/tools` | Allowlisted tools with permission + confirmation checks | add a `ToolSpec` |
| `app/workspace` | `policy.py` (the only path resolver) and `service.py` | change policy only with tests |
| `app/security` | Secret redaction, untrusted-content fencing | add patterns + tests |
| `app/memory` | Memory retrieval | swap scoring |
| `app/audit` | Audit log (metadata only) | — |

Security rule: never read or write a workspace path without `resolve_inside()`.
