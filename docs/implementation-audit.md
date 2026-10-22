# ORBIT implementation audit

**Audit date:** 2026-10-21  
**Checkout:** `feat/phase-8-deployment-submission` (working tree clean at inspection)  
**Scope note:** The request names `ORBIT_PRD.pdf`, but no copy was found in this checkout or the supplied Codex attachments. The feature groups and T1–T10 in the request were therefore used as a provisional checklist. Exact FR wording, API schema, demo persona constraints, and scoring rules cannot be verified until the PRD is supplied. This audit is based on source inspection and the commands/results recorded below, not on README status claims alone.

## Stack and baseline

- Backend: Python 3.11, FastAPI, Pydantic 2, SQLAlchemy 2, Alembic, PostgreSQL/pgvector configuration, SQLite test fixtures.
- Frontend: React 18, TypeScript, Vite, Vitest, React Three Fiber, MediaPipe Tasks Vision.
- Extension: TypeScript VS Code extension with npm lockfile and a checked-in VSIX.
- Persistence: Alembic migrations; models include users and user-owned memories, tasks, notes, projects, schedules, actions, workspaces, conversations, and tool permissions.
- Working tree was clean before inspection. No source files or lockfiles were modified during baseline checks.

| Command | Result |
|---|---|
| `python -m pytest -q -rs` (backend) | **Passed after changes:** 87 passed, 2 skipped, 2 deprecation warnings (23.39s). Both skips are symlink-policy tests requiring a Windows privilege unavailable to this account. |
| `ruff check app tests` (backend) | **Passed after import-order correction:** all checks passed. |
| `python -m pip install -e ".[dev]"` (backend) | Dev tools became available and the test/lint runs below completed. A repeat could not fetch isolated `setuptools>=68` because network access is denied. No project manifest/lockfile changed. |
| `npm run typecheck` (frontend), before dependency install attempt | **Passed** (`tsc --noEmit`). |
| `npm test -- --run` (frontend), before dependency install attempt | Blocked: Vite/esbuild could not read a parent directory outside the workspace (`Access is denied`). |
| `npm run build` (frontend), before dependency install attempt | TypeScript stage passed; Vite build blocked by the same sandbox parent-directory access error. |
| `npm ci` (frontend) | Blocked twice: Windows returned `EPERM` unlinking the Rollup native binary in `node_modules`; lockfiles unchanged. The ignored `node_modules` is now incomplete (Vitest and Vite command shims are missing), so later frontend checks fail at dependency resolution. |
| `npm run compile` (VS Code extension) | **Passed** (`tsc -p .`). |
| Docker availability | Docker CLI is installed; daemon/database startup and PostgreSQL runtime were not verified. |

No live provider key, real Nebius/NVIDIA call, PostgreSQL service, browser session, physical camera, extension host, deployment, or demo video was verified. `.env` was not read or printed.

## Provisional requirement inventory

Status meanings: **Implemented (source)** means the code path exists; **Partial** means a substantial path exists but its PRD fit or runtime behavior remains unverified; **Blocked** means required source material or environment is missing. Existing automated tests are named where they provide likely coverage; they were not run where the environment lacked dependencies.

| Requirement | Current implementation and evidence | Status / gap |
|---|---|---|
| FR-01 Authentication | JWT bearer auth, bcrypt password hashing, auth throttling; `backend/app/auth.py`, `backend/tests/test_auth.py`. | Partial: backend suite passes, but full cross-user isolation acceptance remains incomplete. |
| FR-02 Agent | Bounded orchestration and tool registry in `backend/app/agent/orchestrator.py`, `backend/app/tools/agent_registry.py`; tests in `test_agent_tools.py`. | Partial: unit suite passes; live provider and full production DB workflow not run here. |
| FR-03 Persistent memory | Typed memory records, vector column, embedding/rank/dedupe service; `backend/app/memory/service.py`, `test_memory_service.py`. | Partial: actual PostgreSQL/pgvector and restart persistence unverified; PRD similarity formula unavailable. |
| FR-04 Tools | Allowlisted tool registries and permission checks; `test_agent_tools.py`, `test_policy.py`. | Partial: full execution/ownership cases not run. |
| FR-05 Scheduling | Deterministic scheduler and extraction path; `backend/app/schedule/service.py`, `test_schedule.py`. | Partial: PRD demo persona and acceptance constraints unavailable; tests not run. |
| FR-06 Approval flow | Pending actions and approve/reject handlers in `routes.py`; action tests exist. | Partial: reject/idempotency/ownership acceptance verification not run. |
| FR-07 Dashboard | Home screen exists at `frontend/src/features/home/HomePage.tsx`. | Partial: browser states and visual review not verified. |
| FR-08 Chat | Chat screen, WebSocket event stream, HTTP fallback, recall chips and action UI. | Partial: frontend/backend tests and live provider stream not verified. |
| FR-09 Tasks | User-owned task model and CRUD API/UI; `test_api.py`. | Partial: API smoke and cross-user checks not run. |
| FR-10 Memory UI | Search/create/delete memory screen and API. | Partial: persistence and user isolation not runtime verified. |
| FR-11–12 P0 resource/UI requirements | Authenticated project and note CRUD APIs now exist in `backend/app/api/routes.py`; frontend also has projects/workspace screens. | Partial: backend CRUD, ownership, and linked-note tests pass; a user-facing project/note management UI and exact PRD mapping remain outstanding. |
| FR-13 VS Code integration | Extension source, manifest, README and VSIX exist under `vscode-extension/`. | Partial: package compile/install/manual host checks not run in this baseline. |
| FR-14 Explain Selection | Code explanation request supports selected context in `backend/app/workspace/code_explain.py`; extension/frontend paths present. | Partial: secret exclusion/consent runtime checks not run. |
| FR-15 Explain File | Workspace file access uses workspace policy and code explanation flow. | Partial: needs executable tests and VS Code verification. |
| FR-16 Explain Project | Workspace summarization and project explain path exist. | Partial: payload limits and result quality unverified. |
| FR-17 Trace Flow | Source and demo FastAPI repository include explain/trace support; `test_code_explain.py`. | Partial: requested `POST /login` trace acceptance not run. |
| FR-18–20 Camera gestures, 3D interactions, vision-to-memory | Browser-side gesture logic, scene controls, fallback UI and `/api/vision/context` exist; `frontend/tests/gestures.test.ts`. | Partial: hardware/browser behavior and persistence workflow not run. |
| FR-21 Model/tool transparency | Gateway metadata and per-user debug turn route exist. | Partial: no real request was made to compare displayed details against provider execution. |
| FR-22 Graceful failures | Shared API errors, provider retry/configuration, WebSocket error event, UI error handling exist. | Partial: simulated outage and invalid JSON integration tests not run. |
| FR-23 Optional voice | No voice flow was found during source inventory. | Blocked pending exact PRD scope; lower priority. |
| FR-24 Optional web research | No web-research provider/tool was found during source inventory. | Blocked pending exact PRD scope; lower priority. |
| FR-25 Submission docs/assets | README, LICENSE, FEEDBACK.md, architecture diagram/docs, security and submission docs exist. | Partial: claims and deliverables need final review against the missing PRD and actual deployment. |

### T1–T10 acceptance checklist

| Test | Evidence found | Current result |
|---|---|---|
| T1 Persistent memory across restarts | Memory service/API unit tests pass; no restart E2E harness or configured PostgreSQL verified. | Partial; PostgreSQL/runtime unavailable. |
| T2 Schedule generation | Scheduler tests pass. | Partial; exact PRD demo persona absent with PRD. |
| T3 Approval reject/approve exactly once | Pending-action implementation and unit/API tests pass. | Partial; cross-user visibility and approval are covered; production DB acceptance remains outstanding. |
| T4 Explain selection/file/project with secret exclusion | Code explanation and redaction tests pass. | Partial; no VS Code/browser E2E run. |
| T5 Trace `POST /login` through actual layers | Demo repository and code explanation tests pass. | Partial; exact PRD acceptance prompts unavailable. |
| T6 Four camera gestures and fallback | Gesture unit tests exist. | Partial; no browser/camera device verification. |
| T7 Vision memory retrieval | Vision endpoint and memory tests pass independently. | Partial; not run end to end across UI and persistent PostgreSQL. |
| T8 Model outage stability | Gateway tests pass. | Partial; no live provider outage or full UI recovery check. |
| T9 Clean clone setup and repeatable seed | README/setup and `scripts/seed_demo.py` exist. | Not run; dependency install and database required. |
| T10 Actual model/transparency details | Gateway and debug endpoint exist. | Not run; no provider credentials or live request. |

## Security and quality findings

- The API router applies `get_current_user`; the auth dependency sets the SQLAlchemy session owner, and `backend/app/db/session.py` scopes ORM reads and assigns owners on inserts. This is a broad defense-in-depth mechanism, but direct ownership/deletion paths still need explicit two-user API tests before declaring isolation accepted.
- Workspace reads pass through `backend/app/workspace/policy.py`; code explanation and redaction tests are present. Real extension collection and hosted-send confirmation remain unverified.
- The checked-in `docs/GAP_ANALYSIS.md` describes a materially earlier repository state (for example, it says authentication, PostgreSQL, and gestures are missing, while current source contains them). It should be refreshed or clearly marked as historical to avoid misleading implementers.
- No dead-code or asset removal was justified by this inspection. Deleting the VSIX, examples, migrations, seed scripts, tests, or demo repository would be unsafe without deeper usage evidence.

## Prioritized implementation and verification plan

1. Obtain the actual `ORBIT_PRD.pdf`; reconcile each FR and acceptance criterion with this provisional checklist.
2. Restore a testable environment using the repository lockfiles/manifests; run backend tests, frontend tests/build, extension typecheck/package, and lint. Current installation failures require network/file-lock resolution outside the present sandbox.
3. Add/execute explicit cross-user tests across task, project, memory, schedule, note, workspace, permission, conversation, and pending-action endpoints.
4. Run PostgreSQL + pgvector migrations and acceptance flows; verify restart persistence and approval state transitions.
5. Run deterministic T1–T10 journeys where possible; separately report credential, hardware, browser, and deployment blockers.
6. Refresh stale gap analysis and submission status only after test evidence exists; then consider any cleanup backed by import/runtime checks.
