# ORBIT PRD gap analysis

Assessment of the checked-out `developing` branch against the Personal AI PRD
provided on 2026-10-19. This describes the repository before the Phase 0 work
in this change. Existing documented status has not been treated as independent
verification.

## Implementation progress

Phases 0–4 are implemented on sequential feature branches. Phase 3 adds six
intent labels, a maximum of three model tool rounds, typed tool arguments,
metadata-only audit records, and approval-gated writes. Phase 4 adds an
authenticated WebSocket event stream, approval and memory UI, answer rationale,
and per-user debug turns. The schedule tool is a registered placeholder.
Verification results and remaining limits are kept in the README feature table.

## Current repository

- The backend is a FastAPI application using SQLAlchemy, SQLite by default,
  Alembic scaffolding, an HTTP Nebius chat provider, a deterministic demo
  provider, a skill-based orchestrator, and keyword memory retrieval.
- Existing safety controls include workspace path policy, secret redaction,
  external-send consent, write proposals with approval, audit metadata, API
  rate limiting, and strict CORS. These must remain in place during migration.
- The React/TypeScript frontend contains Home, Chat, Memory, Tasks, Projects,
  Skills, Settings, and Visual Learning screens. It has a 3D learning scene and
  camera preview; gesture recognition is not implemented.
- Tests and setup notes exist, but the current checkout has not been freshly
  verified against the complete PRD acceptance suite.

## Phase-by-phase gaps

| PRD area | Existing foundation | Gap / required work |
|---|---|---|
| Product and submission | README has a feature table and describes current limitations. | README positions ORBIT as local-first/desktop-style and centers a visual learning studio. Reframe around persistent work memory, planning, code understanding, and permission-gated action. Add submission assets and keep status claims evidence-based. |
| Phase 0: model gateway | `providers/nebius.py` calls Nebius's compatible chat endpoint; demo behavior exists; config has one Nebius model and timeout. | No shared provider gateway, NVIDIA provider, per-task model routing, embedding interface/fallback, retry, stream interface, token/latency logging, or reachability status. `scripts/list_models.py` is referenced but absent. Health does not yet expose meaningful provider reachability. |
| Phase 1: data and auth | SQLAlchemy models cover memories, conversations/messages, workspaces, proposals, tasks, skills, and audit. Alembic is scaffolded. | SQLite and `create_all` are the runtime path. No PostgreSQL/pgvector configuration or migration history. No users/authentication or user ownership; schedule blocks, notes, pending actions, and tool permissions are absent. Every affected query needs user scoping when multi-user support is added. |
| Phase 2: memory | CRUD, confirmation, search, and delete behavior exist, with keyword scoring. | No embeddings, typed memory taxonomy from the PRD, importance gate, semantic dedupe/ranking/recency, access updates, or persistence-across-restart verification. Small-talk filtering is not model-gated. |
| Phase 3: agent and tools | Skill registry validates model outputs; tool registry supports workspace operations and approval proposals. | Current chat selects among four skills rather than the specified intent loop. Required task/note/memory/schedule/code/vision tools and tool-call loop are missing. No pending-action approval endpoints for model-proposed writes, debug last-turns endpoint, or per-tool session trust. Execute permission remains future work. |
| Phase 4: streaming and UI | Chat and required broad screen categories are present; API client and UI tests exist. | No WebSocket/SSE token stream, event protocol, tool-call cards, recalled-memory chips, answer explanation, or debug panel. “Developer” is currently Projects/workspaces. Loading, empty, and error state coverage and real-browser review need verification. |
| Phase 5: scheduling | Tasks can be created and managed. | No schedule-block model, extraction/packing/rationale pipeline, approval flow, date retrieval, conflict/overflow handling, or scheduler tests. |
| Phase 6: developer intelligence | Authorized workspace listing/search/preview and workspace-aware chat exist, with redaction and consent. | No structured `/api/code/explain` modes, map/reduce project analysis, project-summary memory, VS Code extension, or seeded demo repository. Existing web workspace protections should be reused. |
| Phase 7: vision | Browser camera preview and curated 3D architecture learning scene exist. | No MediaPipe hand tracking, gesture smoothing/debounce, gesture-driven architecture view, project-linked vision memory, or verified 20+ FPS browser flow. User-prompted camera and no-upload behavior must be retained. |
| Phase 8: deployment | README has local setup; license and `.env.example` exist. | No Docker Compose/Postgres deployment path, deployed public demo, demo seed script, Nebius-backed deployment proof, `FEEDBACK.md`, or finalized submission write-up. |

## Existing security controls to preserve

Continue to route workspace access through the existing policy, redact before
hosted inference, require consent before sending selected file text, retain
proposal/approval checks for writes, keep audit records metadata-only, preserve
rate limiting and strict CORS, and validate model/tool output. New user-scoped
routes must not make these controls optional. The current controls and their
known limitations are documented in `SECURITY_MODEL.md`, `THREAT_MODEL.md`, and
`WORKSPACE_ACCESS.md`.

## Implementation order

Follow the supplied phase order. Begin with the common provider gateway and
tests (Phase 0), then introduce the PostgreSQL/migration/auth foundation before
adding vector memory or user-scoped agent behavior. Keep README feature claims
aligned with what can be demonstrated. Deployment and live-provider behavior
remain unverified until exercised with real credentials and an accessible
deployment environment.

## Repository workflow constraints

At assessment time the checkout is on local branch `developing`, has a clean
working tree, and is seven commits behind `origin/developing`. No local `develop`
or `main` branch is present. The requested feature-branch-from-`develop`
workflow and always-deployable `main` therefore cannot be satisfied from the
available local refs without refreshing remote state; implementation should
not rewrite history to fabricate that base.
