# TASKS

Task board for **Chirag** and **Charanjeet**. All statuses start at **Not Started**: files that exist in this scaffold are a *starting point*, not completed work. A task is Done only when its acceptance criteria have been verified.

Owners come from the assignment in the project brief (Chirag: agent, backend, integrations, security; Charanjeet: frontend and UX). Nothing here assumes anyone's skill level or any work that hasn't been confirmed.

## Recent improvements (refinement pass)

The following improvements were made during a project-wide refinement pass:

- **Performance — route-based code splitting:** All feature pages are lazy-loaded. Three.js and MediaPipe are split into separate chunks that load only when Visual Learning is opened. Initial bundle reduced from 1.3 MB to ~249 kB (78 kB gzip).
- **MediaPipe FPS fix (root cause):** The 50 ms inference throttle was limiting tracking to exactly 20 FPS, then stopping when "below 20 FPS." Fixed: throttle reduced to 28 ms (~30 FPS target), stop threshold lowered to 8 FPS, warm-up increased to 5 s, and four consecutive low-FPS windows required before fallback. FPS display updates every 2 s to reduce React state churn.
- **3D scene improvements:** Added hemisphere lighting, a second directional light, PBR materials (roughness/metalness), and pinch-to-grab camera rotation via continuous hand tracking. Hand tracking uses refs (not React state) to avoid re-renders during inference.
- **Amazon-like e-commerce system-design scene:** 11 components (CDN, API Gateway, Catalog, Cart, Order, Payment, Inventory, Database, Cache, Queue) with structured learning content (APIs, data models, scaling, failure modes, trade-offs) and a system-design overview panel (requirements, assumptions, architecture, request flow).
- **Backend system-design skill:** New `system_design` skill registered for interview-style architecture explanations. Intent routing added for system-design keywords. Demo output provided for no-provider mode.
- **Design system:** Refined dark color palette, scrollbar styling, focus states, and shared UI tokens.
- **Tests:** Added 9 frontend scene-data tests and 3 backend system-design skill/intent tests. All pass (91 backend, 24 frontend).

## What exists today (starting point)
- **Backend (tested, 51 passing tests):** health, chat orchestration, provider interface with Nebius (mock-tested only), demo mode, skills registry with 4 skills, memory CRUD, workspace policy, proposal/approval flow, tasks, audit log, redaction.
- **Frontend (typecheck, 10 tests, and build pass):** all eight screens, design primitives, typed API client, 3D scene, camera panel. Not yet reviewed in a real browser.
- **Not verified:** live Nebius call, the default model ID, WebGL rendering, camera on a real device.
- **Not built:** streaming, OpenCV/MediaPipe, local API token, Docker, Tauri, most docs listed in DOC-01.

## Milestones and integration order
1. **M1 Foundations agreed** (SH-01..04) can all start immediately, in parallel.
2. **M2 Real model working** (AI-01, then AI-02). Frontend polish (FE-01, FE-02) runs in parallel.
3. **M3 Project intelligence** (BE-03, SEC-03, SEC-04, FE-06) and **Visual studio** (FE-07, FE-08) run in parallel.
4. **M4 Integrated and reviewed** (IN-01..03, SEC-05, QA-02/03).
5. **M5 Demo ready** (DEMO-01..03). Deadline per your project file.

Integration order: AI-01 → IN-01 → BE-03 → IN-02 → SEC-05 → QA-03 → DEMO.

**Parallel-safe now (no dependencies):** SH-01..04, BE-01, SEC-01, FE-01, FE-02, AI-06, FE-05, SEC-03, SEC-04, FE-06, FE-07, FE-08, CV-02, IN-04, QA-01, DOC-01.
**Needs a teammate's work:** anything with a dependency listed on its card; FE-04 needs AI-04, CV-01 needs FE-08, IN-01 needs AI-01 and FE-02.

## Definition of Done
- Acceptance criteria verified (not assumed) and the evidence noted in the PR.
- Tests listed on the card exist and pass in CI.
- Security implications considered; permissions and validation enforced in the backend.
- Docs and `.env.example` updated if behavior or config changed.
- No secrets, personal files, or dead buttons added.
- Reviewed by the other teammate and merged to `main`.

## How to Pick Up the Next Task
1. Filter this file for your name or **Shared**, status **Not Started**.
2. Skip tasks whose dependencies aren't Done.
3. Take the highest priority (P0 before P1 before P2), then the earliest phase.
4. Create `feat/<task-id>-name`, set status to **In Progress**, and say so to your teammate.
5. If blocked, set **Blocked** with a one-line reason.
6. When criteria are verified, open the PR and set **Done** in the same PR.


## Phase 0: Repository setup and agreements

### SH-01: Agree workflow and protect main
- **Owner:** Shared | **Priority:** P0 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Create the Git remote, protect `main`, agree on branch names and PR review from `docs/TEAM_WORKFLOW.md`.
- **Files/modules:** GitHub settings, `docs/TEAM_WORKFLOW.md`
- **Acceptance criteria:** Both can open and merge a PR; CI runs on PRs.
- **Tests required:** None

### SH-02: Verify local setup on both machines
- **Owner:** Shared | **Priority:** P0 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Each teammate follows the README from a fresh clone and fixes any gap in the instructions.
- **Files/modules:** `README.md`, `scripts/dev.sh`
- **Acceptance criteria:** Both machines: backend tests pass, frontend builds, app loads in demo mode.
- **Tests required:** Existing suites

### SH-03: Confirm hackathon model and infrastructure rules
- **Owner:** Shared | **Priority:** P0 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Read the current rules for the Personal AI track: which NVIDIA model families and which Nebius services count, and what evidence is required.
- **Files/modules:** `docs/` (add a short note)
- **Acceptance criteria:** Written note naming the exact eligible model and the evidence the submission needs.
- **Tests required:** None

### SH-04: Freeze the v0 API contract
- **Owner:** Shared | **Priority:** P1 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Review `docs/API_REFERENCE.md` and `/api/docs`; list changes needed before integration; agree who edits `schemas.py` and `types/api.ts`.
- **Files/modules:** `backend/app/schemas.py`, `frontend/src/types/api.ts`
- **Acceptance criteria:** Contract changes listed; both files agree.
- **Tests required:** Schema tests for any change


## Phase 1: Application shell and backend foundation

### BE-01: Alembic initial migration
- **Owner:** Chirag | **Priority:** P1 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Alembic is scaffolded but has no revision; tables come from `create_all`. Generate the initial revision, run migrations on startup or via a documented command, remove `create_all` from production path.
- **Files/modules:** `backend/migrations/`, `backend/app/db/session.py`, `backend/README.md`
- **Acceptance criteria:** A fresh database is created by `alembic upgrade head`; adding a column via a new revision works on an existing DB.
- **Tests required:** Test that migrates an empty DB and runs the API suite

### SEC-01: Local API session token
- **Owner:** Chirag | **Priority:** P1 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Any local process can call the API today. Generate a random token at startup, pass it to the frontend (for example via a one-time URL fragment or dev proxy header), require it on every request.
- **Files/modules:** `backend/app/main.py`, `backend/app/api/deps.py`, `frontend/src/lib/api.ts`
- **Acceptance criteria:** Requests without the token get 401; the app works end to end; token is not logged.
- **Tests required:** API tests for 401/200

### FE-01: Typography and design-token review
- **Owner:** Charanjeet | **Priority:** P2 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Fonts currently fall back to system fonts. Decide on and self-host the final typefaces (no external CDN at runtime), review the palette against contrast requirements.
- **Files/modules:** `frontend/src/styles/index.css`
- **Acceptance criteria:** All text meets WCAG AA contrast; fonts load offline.
- **Tests required:** Manual contrast check

### FE-02: Responsive and accessibility pass on the shell and all screens
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Check 360px, 768px, 1280px widths; keyboard-only navigation; focus order; dialog focus trapping; screen-reader labels.
- **Files/modules:** `frontend/src/app/Shell.tsx`, `frontend/src/features/*`
- **Acceptance criteria:** Every screen is usable by keyboard alone and at 360px width; no horizontal page scroll.
- **Tests required:** Add component tests for dialogs and nav

### FE-03: Generate TypeScript types from OpenAPI
- **Owner:** Charanjeet | **Priority:** P2 | **Status:** Not Started
- **Depends on:** SH-04
- **Description:** Replace hand-written `types/api.ts` with generated types from `/api/openapi.json` (for example `openapi-typescript`) and a script to refresh them.
- **Files/modules:** `frontend/package.json`, `frontend/src/types/`
- **Acceptance criteria:** `npm run gen:types` updates types; typecheck passes.
- **Tests required:** `npm run typecheck`


## Phase 2: Agent, provider integration, and reusable skills

### AI-01: Verify a live Nebius + Nemotron call
- **Owner:** Chirag | **Priority:** P0 | **Status:** Not Started
- **Depends on:** SH-03
- **Description:** Create a key, run `scripts/list_models.py`, set `NEBIUS_MODEL` to a real eligible ID, run chat for all four skills. Record which model ID worked and how reasoning output arrives (the provider treats empty `content` as an error).
- **Files/modules:** `.env.example`, `backend/app/providers/nebius.py`, `docs/`
- **Acceptance criteria:** General Q&A returns a validated structured answer from the real model; model ID in `.env.example` is verified; failure modes tested manually (bad key, bad model).
- **Tests required:** Keep mocked tests; add a skipped-by-default live test

### AI-02: Prompt and structured-output reliability for the four built-in skills
- **Owner:** Chirag | **Priority:** P0 | **Status:** Not Started
- **Depends on:** AI-01
- **Description:** Run 20 varied prompts per skill; measure how often output validates; tune prompts or add one repair retry.
- **Files/modules:** `backend/app/skills/builtin.py`, `backend/app/agent/orchestrator.py`
- **Acceptance criteria:** At least 90% of test prompts validate without fallback (record the measured number).
- **Tests required:** Fixture-based tests for the repair path

### AI-03: Model-based skill routing
- **Owner:** Chirag | **Priority:** P2 | **Status:** Not Started
- **Depends on:** AI-01
- **Description:** Keyword routing is a placeholder. Add an optional model call that selects a skill from enabled skills, validated against the registry.
- **Files/modules:** `backend/app/agent/orchestrator.py`
- **Acceptance criteria:** Router never selects a disabled or unknown skill; falls back to keywords on failure.
- **Tests required:** Unit tests with a fake provider

### AI-04: Streaming responses (backend)
- **Owner:** Chirag | **Priority:** P1 | **Status:** Not Started
- **Depends on:** AI-01
- **Description:** Add a streaming endpoint (SSE) for the provider; structured validation happens at the end.
- **Files/modules:** `backend/app/api/routes.py`, `backend/app/providers/`
- **Acceptance criteria:** Tokens arrive incrementally; final validated result is identical in shape to `/api/chat`.
- **Tests required:** API test with a fake streaming provider

### FE-04: Streaming chat UI
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Not Started
- **Depends on:** AI-04
- **Description:** Render incremental text, then swap in the structured view when validated; cancel button.
- **Files/modules:** `frontend/src/features/chat/`
- **Acceptance criteria:** Partial text visible within a second; cancel works; errors shown inline.
- **Tests required:** Component test with a mocked stream

### AI-05: Skill: understand a project
- **Owner:** Chirag | **Priority:** P1 | **Status:** Not Started
- **Depends on:** AI-01
- **Description:** New skill that takes the local workspace summary plus a few user-selected files and returns an architecture note. Declares `workspace.read`.
- **Files/modules:** `backend/app/skills/`, `docs/SKILL_DEVELOPMENT.md`
- **Acceptance criteria:** Works on `examples/example-project`; refuses without a workspace; consent dialog still appears.
- **Tests required:** Registration, permission, and demo-output tests


## Phase 3: Memory and structured outputs

### AI-06: Evaluate memory retrieval quality
- **Owner:** Chirag | **Priority:** P2 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Keyword overlap is crude. Build a small labeled set of 20 query/memory pairs and compare keyword scoring against BM25 (and embeddings only if justified).
- **Files/modules:** `backend/app/memory/service.py`
- **Acceptance criteria:** Written result with recall numbers; only adopt a change that beats the baseline.
- **Tests required:** Retrieval tests using the labeled set

### AI-07: Memory suggestion quality
- **Owner:** Chirag | **Priority:** P1 | **Status:** Not Started
- **Depends on:** AI-01
- **Description:** Tune when the model proposes `suggested_memory` so it only suggests durable facts the user stated, never sensitive guesses.
- **Files/modules:** `backend/app/skills/builtin.py`
- **Acceptance criteria:** On a 20-prompt set, no suggestions are invented or sensitive.
- **Tests required:** Prompt regression fixtures

### FE-05: Memory page filters and bulk actions
- **Owner:** Charanjeet | **Priority:** P2 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Filter by type/source/confirmed; confirm multiple suggestions at once.
- **Files/modules:** `frontend/src/features/memory/`
- **Acceptance criteria:** Filters work together with search; bulk confirm is undoable by delete.
- **Tests required:** Component tests


## Phase 4: Secure workspace and project intelligence

### SEC-03: Broaden secret redaction
- **Owner:** Chirag | **Priority:** P0 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Add more patterns (cloud keys, database URLs with passwords, Slack/Stripe tokens) and an entropy check for long random strings; document false-positive trade-offs.
- **Files/modules:** `backend/app/security/redaction.py`, `backend/tests/test_redaction.py`
- **Acceptance criteria:** Each new pattern has a positive and a negative test; redaction count shown in UI.
- **Tests required:** Extend `test_redaction.py`

### SEC-04: Close the check-then-write window
- **Owner:** Chirag | **Priority:** P1 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Writes resolve the path, then write. Open with `O_NOFOLLOW`/use directory file descriptors where available, and re-verify after open.
- **Files/modules:** `backend/app/workspace/service.py`
- **Acceptance criteria:** A test that swaps a symlink between check and write cannot escape.
- **Tests required:** Race/symlink test

### BE-03: Project question answering with ranked retrieval
- **Owner:** Chirag | **Priority:** P0 | **Status:** Not Started
- **Depends on:** AI-01
- **Description:** Today the user selects files. Add retrieval that proposes the most relevant authorized files for a question (filename + content scoring), shows them to the user, and sends only the files they confirm.
- **Files/modules:** `backend/app/workspace/service.py`, `backend/app/agent/orchestrator.py`, `frontend/src/features/chat/`
- **Acceptance criteria:** Asking about the example project proposes relevant files; nothing is sent without the consent dialog.
- **Tests required:** Retrieval and consent tests

### FE-06: File tree and diff viewer
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Collapsible folder tree; side-by-side or inline diff for proposed changes with line highlights.
- **Files/modules:** `frontend/src/features/projects/`
- **Acceptance criteria:** Large trees stay responsive; diff clearly shows additions and removals.
- **Tests required:** Component tests

### AI-08: AI-drafted file changes
- **Owner:** Chirag | **Priority:** P2 | **Status:** Not Started
- **Depends on:** AI-01, BE-03
- **Description:** Let the model draft `new_content` for a user's request; it must still enter the proposal and approval flow.
- **Files/modules:** `backend/app/skills/`
- **Acceptance criteria:** Drafts never write; proposal shows a visible diff; stale-hash check still applies.
- **Tests required:** Skill and approval tests

### SEC-02: Folder selection without typing paths
- **Owner:** Shared | **Priority:** P2 | **Status:** Not Started
- **Depends on:** IN-04
- **Description:** A browser can't pick absolute paths. Use a native folder dialog once packaged (Tauri) or document the typed-path limitation.
- **Files/modules:** `frontend/`, packaging config
- **Acceptance criteria:** Folder picker returns a path validated by the backend as today.
- **Tests required:** Manual


## Phase 5: Visual Learning Studio

### FE-07: Scene polish and verification
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Open the scene in real browsers and phones, fix label overlap, camera presets, performance; verify the WebGL error state.
- **Files/modules:** `frontend/src/features/visual-learning/`
- **Acceptance criteria:** Smooth interaction on a mid-range laptop; error state shows when WebGL is disabled.
- **Tests required:** Manual checklist items

### FE-08: Second curated scene
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Build one more scene (for example event-driven serverless) with explanations; enable it in `subjects`.
- **Files/modules:** `frontend/src/features/visual-learning/scenes.ts`
- **Acceptance criteria:** Scene passes the data integrity test; step-by-step mode works.
- **Tests required:** Existing data tests

### CV-01: Marker-based subject recognition prototype
- **Owner:** Chirag | **Priority:** P2 | **Status:** Not Started
- **Depends on:** FE-08
- **Description:** Recognize printed markers (for example ArUco) with OpenCV or a browser library to select a curated scene. Do not claim general object recognition.
- **Files/modules:** new module under `backend/` or `frontend/src/features/visual-learning/`
- **Acceptance criteria:** Showing a marker selects the right scene; no frames are stored or uploaded.
- **Tests required:** Unit test on sample images

### CV-02: Gesture control with MediaPipe
- **Owner:** Charanjeet | **Priority:** P2 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Optional hand gestures for rotate/zoom, opt-in and processed in the browser.
- **Files/modules:** `frontend/src/features/visual-learning/`
- **Acceptance criteria:** Works when enabled; off by default; camera indicator remains visible.
- **Tests required:** Manual

### AI-09: AI explanation of a selected component
- **Owner:** Chirag | **Priority:** P2 | **Status:** Not Started
- **Depends on:** AI-01
- **Description:** Endpoint that expands the curated description for a component using the model, labeled as AI-generated.
- **Files/modules:** `backend/app/skills/`, `frontend/src/features/visual-learning/`
- **Acceptance criteria:** Output labeled AI-generated; falls back to curated text when unconfigured.
- **Tests required:** Skill tests


## Phase 6: Frontend-backend integration

### IN-01: End-to-end chat with the real provider
- **Owner:** Shared | **Priority:** P0 | **Status:** Not Started
- **Depends on:** AI-01, FE-02
- **Description:** Run the full chat loop in the browser against Nebius; fix any contract mismatches.
- **Files/modules:** `frontend/src/features/chat/`, `backend/`
- **Acceptance criteria:** Smoke checklist chat items pass with a real key.
- **Tests required:** Manual checklist

### IN-02: End-to-end workspace and approval flows
- **Owner:** Shared | **Priority:** P0 | **Status:** Not Started
- **Depends on:** AI-01
- **Description:** Authorize the example project, explain a file with the hosted provider, redaction visible, consent dialog, propose and approve a change.
- **Files/modules:** `frontend/src/features/projects/`, `backend/app/api/`
- **Acceptance criteria:** Smoke checklist workspace items pass.
- **Tests required:** Manual checklist

### IN-03: Failure-state pass
- **Owner:** Shared | **Priority:** P1 | **Status:** Not Started
- **Depends on:** IN-01
- **Description:** Backend down, bad key, rate limit, empty reasoning response, oversized file: each shows a useful message.
- **Files/modules:** `frontend/src/components/ui.tsx`, features
- **Acceptance criteria:** Each failure produces a clear, non-technical message and recovery action.
- **Tests required:** Component tests for ErrorState cases

### IN-04: Decide packaging: local web vs Tauri
- **Owner:** Shared | **Priority:** P2 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Decide and document how the app will ship for the demo; do not build a pipeline unless needed.
- **Files/modules:** `docs/`
- **Acceptance criteria:** Decision recorded with rationale.
- **Tests required:** None


## Phase 7: Testing, security review, and documentation

### QA-01: Backend quality gates in CI
- **Owner:** Chirag | **Priority:** P1 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Add coverage reporting and format checking to CI; keep ruff clean.
- **Files/modules:** `.github/workflows/ci.yml`, `backend/pyproject.toml`
- **Acceptance criteria:** CI fails on lint, test, or coverage regression.
- **Tests required:** CI run

### QA-02: Frontend integration tests
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Not Started
- **Depends on:** FE-02
- **Description:** Add tests that render pages against a mocked API (for example MSW) covering empty, loading, error, and success states.
- **Files/modules:** `frontend/tests/`
- **Acceptance criteria:** Each primary screen has tests for all four states.
- **Tests required:** `npm test`

### SEC-05: Security review and prompt-injection tests
- **Owner:** Shared | **Priority:** P0 | **Status:** Not Started
- **Depends on:** AI-02
- **Description:** Walk through `docs/THREAT_MODEL.md`; write test documents containing injected instructions and run them against the real model; record results honestly.
- **Files/modules:** `backend/tests/`, `docs/THREAT_MODEL.md`
- **Acceptance criteria:** Documented results; any bypass found has a fix or a documented limitation.
- **Tests required:** New injection fixtures

### DOC-01: Write the remaining documents
- **Owner:** Shared | **Priority:** P1 | **Status:** Not Started
- **Depends on:** none (can start now)
- **Description:** Not yet written: `PROJECT_OVERVIEW`, `DATA_FLOW`, `DATABASE_SCHEMA`, `AI_AGENT_DESIGN`, `MEMORY_DESIGN`, `UI_UX_GUIDE`, `DEPLOYMENT`, `TROUBLESHOOTING`, plus `docker-compose.yml` if wanted. Per-folder READMEs for each backend package.
- **Files/modules:** `docs/`
- **Acceptance criteria:** Each document is accurate to the code and links from the README.
- **Tests required:** Doc review

### QA-03: Run the manual smoke checklist
- **Owner:** Shared | **Priority:** P0 | **Status:** Not Started
- **Depends on:** IN-02, FE-07
- **Description:** Execute every item in `docs/TESTING.md` on a clean checkout and record failures as tasks.
- **Files/modules:** `docs/TESTING.md`
- **Acceptance criteria:** All items pass or have an open task.
- **Tests required:** Manual


## Phase 8: Hackathon demo and submission

### DEMO-01: Demo script and sample project
- **Owner:** Shared | **Priority:** P0 | **Status:** Not Started
- **Depends on:** QA-03
- **Description:** Write a 3-minute demo script using `examples/example-project`, with a fallback if the network fails.
- **Files/modules:** `docs/` (demo script)
- **Acceptance criteria:** Two full rehearsals run without surprises.
- **Tests required:** Rehearsal

### DEMO-02: Backup demo video
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Not Started
- **Depends on:** DEMO-01
- **Description:** Record a clean run in case of live failure.
- **Files/modules:** outside repo
- **Acceptance criteria:** Video under 3 minutes showing real (not demo-mode) model output.
- **Tests required:** Review

### DEMO-03: Submission write-up with provider evidence
- **Owner:** Chirag | **Priority:** P0 | **Status:** Not Started
- **Depends on:** AI-01, SEC-05
- **Description:** Describe truthfully what runs locally vs on Nebius, which model, and what is not implemented. Include evidence of Nebius usage that the rules require.
- **Files/modules:** `README.md`, submission form
- **Acceptance criteria:** Every claim maps to working code; limitations listed.
- **Tests required:** Cross-check against the README status table

### DEMO-04: One-command start
- **Owner:** Chirag | **Priority:** P2 | **Status:** Not Started
- **Depends on:** SH-02
- **Description:** Provide `docker-compose.yml` or a single script for both services if time allows.
- **Files/modules:** `docker-compose.yml`
- **Acceptance criteria:** A fresh machine starts the app with one command.
- **Tests required:** Manual
