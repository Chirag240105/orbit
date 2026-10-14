# ORBIT backend

FastAPI + SQLAlchemy + Pydantic. Runs locally on `127.0.0.1:8000`.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp ../.env.example ../.env          # then edit
uvicorn app.main:app_factory --factory --reload
pytest -q && ruff check app tests
```
API docs (when running): http://127.0.0.1:8000/api/docs

| Folder | Responsibility | Extension point |
|---|---|---|
| `app/api` | HTTP routes (thin) | add routes in `routes.py` |
| `app/agent` | Orchestration: route skill, check permissions, build prompt, validate output | `orchestrator.py` |
| `app/providers` | Model providers behind `ChatProvider` | subclass + `build_provider` |
| `app/skills` | Skill base, built-ins, registry | add a `Skill`, register it |
| `app/tools` | Allowlisted tools with permission + confirmation checks | add a `ToolSpec` |
| `app/workspace` | `policy.py` (the only path resolver) and `service.py` | change policy only with tests |
| `app/security` | Secret redaction, untrusted-content fencing | add patterns + tests |
| `app/memory` | Memory retrieval | swap scoring |
| `app/audit` | Audit log (metadata only) | — |

Security rule: never read or write a workspace path without `resolve_inside()`.
