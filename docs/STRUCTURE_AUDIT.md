# ORBIT repository structure audit

**Date:** 2026-10-22  
**Scope:** Tracked and untracked source/documentation files under this repository; excludes `.venv`, `node_modules`, `.git`, and `dist`. This audit records the checkout as inspected, including pre-existing working-tree edits.  
**PRD note:** No `ORBIT_PRD.pdf` or `README/TASKS` file named as a PRD was found. `TASKS.md`, the root/backend READMEs, and the requested target tree are used as available requirements. Claims about exact PRD compliance therefore remain unverified.

## Empty, stub, and TODO inventory

- No non-`__init__.py` source files are empty.
- Empty `__init__.py` files are intentional package markers and are not defects. The empty markers are under `backend/app/` (`agent`, `api`, `audit`, `core`, `db`, `memory`, `security`, `skills`, `tools`, `workspace`), `backend/tests/`, and the example repo packages under `scripts/demo_repo/app/` (`app`, `repositories`, `routers`, `services`). Other package markers contain exports or code.
- Literal `pass` bodies found in production Python are intentional at present: `backend/app/db/session.py` (`Base` declarative base), `backend/app/tools/registry.py` (`ListFilesIn` empty-input schema), `backend/app/tools/agent_registry.py` (`ListTasksArgs` empty-input schema), two expected exception-swallowing branches in `backend/app/agent/orchestrator.py` and `backend/app/schedule/service.py`, and a best-effort WebSocket close in `backend/app/main.py`. They are not unimplemented feature functions. No `TODO` or `NotImplemented` markers were found in project Python/TypeScript source. The `placeholder` references in the UI label the deterministic demo result and input placeholders; they are not missing implementations.
- `TASKS.md` explicitly marks several features as not built or not verified (for example local API token, provider streaming, OpenCV/MediaPipe, Tauri, and deployment). These are roadmap items, not empty files. See `TASKS.md` for their acceptance criteria.

## Imports and dead modules

The Python source import scan found no backend `app` module that exists but is never imported. Every production module under `backend/app` participates in a static import path (including routes and providers loaded through `app.main`). `backend/tests` modules are test-discovered, and migration modules are Alembic-discovered rather than imported by application code.

No unresolved internal production imports were found. `scripts/demo_repo/app` is a separate example application intentionally using generic imports such as `app.storage`, `app.repositories.users`, and `app.services.auth`; those resolve when the example directory is the import root and should not be moved into the ORBIT backend package.

This is a static import audit: dynamically loaded modules, entry points, plugin discovery, and runtime-only imports can evade it. No file is proposed for deletion as dead code.

## Target-layout comparison and proposed moves

| Target | Current state | Proposed disposition |
|---|---|---|
| `backend/app/{api,agent,memory,tools,services,models,schemas,core}/` | `api`, `agent`, `memory`, `tools`, `services`, and `core` are packages. `models.py` and `schemas.py` are single modules; they are imported throughout the backend. | Keep stable imports while the backend repairs proceed. If the directory form is a hard requirement, move each module to `models/__init__.py` and `schemas/__init__.py` (or domain submodules with compatibility re-exports) in a dedicated refactor, updating migrations, tests, and imports together. There is no functional reason to split them yet. |
| `backend/alembic/` | Alembic configuration and revisions live in `backend/migrations/`; `backend/alembic.ini` points there. | Either retain this conventional, working configuration, or move `migrations/` to `alembic/` and update `script_location`, imports, docs, and migration tests atomically. The requested DB repair will use the existing configured location unless migration work requires a coordinated move. |
| `backend/tests/` | Present with API, auth, migration, memory, schedule, security, workspace, and agent tests. | No move. |
| `frontend/src/{pages,components,api,hooks,vision}/` | `components/` exists; screens are in `features/{chat,home,memory,projects,settings,skills,tasks,visual-learning}`; shared API is `lib/api.ts`; there is no `hooks/` or `vision/` directory. | Preserve the working feature-by-domain structure. If required by the target, move screens to `pages/`, the client to `api/`, hooks as they are introduced, and `visual-learning/` to `vision/`, then fix import paths. The existing `visual-learning` screen already contains camera, gesture, and 3D scene code and should be audited before replacing it. |
| `vscode-extension/` | Present with source, manifest, lockfile, README, and packaged VSIX. | No move. Confirm whether committing the generated VSIX is intentional; source and package metadata are sufficient to rebuild it. |
| `docs/` | Present with architecture, API, security, testing, gap, and other project docs. | No move. This audit is added here. |
| `scripts/{seed_demo.py,list_models.py,demo_repo/}` | All three requested entries exist. `scripts/dev.sh` also exists. | No move. |
| Root `README.md`, `LICENSE`, `FEEDBACK.md`, `.env.example`, `docker-compose.yml` | All requested files exist. | No move. `docker-compose.app.yml` is an additional app-oriented compose file, separate from the root compose setup. |
| Other backend packages: `audit/`, `db/`, `providers/`, `schedule/`, `security/`, `skills/`, `workspace/` | Present and used by existing features/tests. | Retain; these are meaningful domain boundaries not represented in the abbreviated target tree. |

## Structural risks to address during implementation

1. `backend/app/api/routes.py` is a 522-line combined API module. It currently owns memory, tasks, schedule, chat, projects, actions, code, vision, and health routes. Split by domain only with explicit router composition and regression coverage; a mechanical move could change dependencies or authorization behavior.
2. The current DB bootstrap still has a `create_all` path in `backend/app/db/session.py`; Alembic revisions already exist under `backend/migrations/`. The migration audit must compare the full live SQLAlchemy metadata and migration head, not merely count tables.
3. The checked-in file tree includes a VSIX binary. The app source and lockfiles should be treated as authoritative unless release policy says otherwise.
4. `TASKS.md` and `docs/implementation-audit.md` describe different verification snapshots. Record actual commands and results for this task rather than copying their historical statuses.

## Result

No genuinely unused backend application module or empty feature implementation was identified for deletion. At audit time, the main layout differences were naming/grouping choices (`migrations`, `models.py`, `schemas.py`, and `frontend/src/features`/`lib`) rather than missing source. The follow-up work and its verification are recorded below.

## Implementation follow-up (2026-10-22)

- Split the API surface into `backend/app/api/{health,chat,actions,projects,memory,vision,skills,code,schedule,tasks}.py`; `routes.py` remains a small compatibility aggregator for the app factory.
- Replaced runtime `create_all` with Alembic upgrade-and-head verification. The existing three-revision history is retained for upgrade compatibility; the final revision matches all current SQLAlchemy metadata on SQLite.
- Moved the existing visual-learning feature into the requested `frontend/src/vision/` location and extended its gestures, fallback, scene, and save flow.
- Added `backend/app/db/migrate.py`, `scripts/reset_dev_db.py`, and troubleshooting instructions. These follow-up changes have automated regression coverage; live PostgreSQL, a physical camera, and a real browser review remain unverified.
