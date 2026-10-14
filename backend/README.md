# ORBIT backend

FastAPI + SQLAlchemy + Alembic + Pydantic. Runs locally on `127.0.0.1:8000`.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp ../.env.example ../.env          # then edit (or run python ../scripts/dev.py, which does all of this)
uvicorn app.main:app_factory --factory --reload
pytest -q --cov=app && ruff check app tests ../examples
```
API docs (when running): http://127.0.0.1:8000/api/docs. Every route except `/api/health` needs `X-Orbit-Token`; the token is in `../.orbit-token` after start (the frontend dev proxy adds it for you).

| Folder | Responsibility | Extension point |
|---|---|---|
| `app/api` | HTTP routes (thin), token check | add routes in `routes.py` with a `response_model` |
| `app/agent` | Chat orchestration and multi-step workflows | `orchestrator.py`, `workflows.py` |
| `app/providers` | Model providers behind `ChatProvider` (`complete`, `stream`) | subclass + `build_provider` |
| `app/skills` | Skill base, built-ins, registry | add a `Skill`, register it |
| `app/tools` | Allowlisted tools with permission + confirmation checks | add a `ToolSpec` |
| `app/workspace` | `policy.py` (the only path resolver) and `service.py` | change policy only with tests |
| `app/security` | Secret redaction, untrusted-content fencing | add patterns + tests |
| `app/memory` | Memory retrieval and suggestion vetting | swap scoring (keep `tests/test_memory_eval.py` passing) |
| `app/db`, `migrations/` | Sessions, Alembic migrations run on start | `alembic revision --autogenerate -m "..."` |
| `app/audit`, `app/core` | Audit log (metadata only), errors, rate limit | — |

Each package has a short README. After changing schemas: `python -m app.openapi_export` (writes the contract snapshot the frontend types come from; `tests/test_contract.py` checks it).

Security rule: never read or write a workspace path without `resolve_inside()`.
