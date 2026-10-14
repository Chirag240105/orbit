# TASKS

Task board for **Chirag** and **Charanjeet**. A task is Done only when its acceptance criteria have been verified **and** it has been reviewed and merged (Definition of Done below).

Owners come from the assignment in the project brief (Chirag: agent, backend, integrations, security; Charanjeet: frontend and UX). Nothing here assumes anyone's skill level or any work that hasn't been confirmed.

**Status legend:** **Implemented, needs review**: code, tests and the card's criteria are verified (evidence on the card); it still needs the other teammate's review and a merge to become Done. **Partly done**: what is missing is named. **Blocked**: the reason is named. **Proposed**: needs a team decision.

## Where things stand (2026-10-15, branch `feat/remaining-tasks`)
- **Backend:** ~160 tests (164 pass on Linux; on Windows 3 symlink tests skip), 92% coverage, ruff clean. Live-model tests are written and skipped until a key is set.
- **Frontend:** 85 tests, typecheck and build pass; 26/26 checks pass in a real browser (Edge) via `npm run e2e`.
- **The one blocker:** **AI-01 needs a Nebius API key.** AI-02 and AI-07 (measurements), IN-01, IN-02 (hosted part), SEC-05 (live run), DEMO-01..03 all wait on it. Hackathon deadline: **30 Oct 2026, 10:00 AM PT** (`docs/HACKATHON.md`).
- **Needs people, not code:** SH-01 (protect `main`), SH-02 (second machine), IN-04 (decide packaging), QA-01 (decide formatter), DEMO rehearsals and video.
- **Not built:** CV-02 (gestures), Tauri. See also the new follow-ups at the end.

## Milestones and integration order
1. **M1 Foundations agreed** (SH-01..04) can all start immediately, in parallel.
2. **M2 Real model working** (AI-01, then AI-02). Frontend polish (FE-01, FE-02) runs in parallel.
3. **M3 Project intelligence** (BE-03, SEC-03, SEC-04, FE-06) and **Visual studio** (FE-07, FE-08) run in parallel.
4. **M4 Integrated and reviewed** (IN-01..03, SEC-05, QA-02/03).
5. **M5 Demo ready** (DEMO-01..03). Deadline: 30 Oct 2026, 10:00 AM PT (verify on Devpost).

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
- **Owner:** Shared | **Priority:** P0 | **Status:** Partly done
- **Evidence:** Remote `github.com/Chirag240105/orbit` and CI exist; work is on branch `feat/remaining-tasks`. Still needed (repo owner): protect `main`, require PR review.
- **Depends on:** none (can start now)
- **Description:** Create the Git remote, protect `main`, agree on branch names and PR review from `docs/TEAM_WORKFLOW.md`.
- **Files/modules:** GitHub settings, `docs/TEAM_WORKFLOW.md`
- **Acceptance criteria:** Both can open and merge a PR; CI runs on PRs.
- **Tests required:** None

### SH-02: Verify local setup on both machines
- **Owner:** Shared | **Priority:** P0 | **Status:** Partly done
- **Evidence:** Verified on one machine (Windows 11, Python 3.11, Node 24): backend and frontend suites pass, `python scripts/dev.py --demo` starts the app. The second machine is still needed.
- **Depends on:** none (can start now)
- **Description:** Each teammate follows the README from a fresh clone and fixes any gap in the instructions.
- **Files/modules:** `README.md`, `scripts/dev.sh`
- **Acceptance criteria:** Both machines: backend tests pass, frontend builds, app loads in demo mode.
- **Tests required:** Existing suites

### SH-03: Confirm hackathon model and infrastructure rules
- **Owner:** Shared | **Priority:** P0 | **Status:** Implemented, needs review
- **Evidence:** `docs/HACKATHON.md`: eligibility, deadline (30 Oct 2026, 10:00 PT), submission requirements, ORBIT gap table. Partly from secondary sources: verify against the full Devpost rules.
- **Depends on:** none (can start now)
- **Description:** Read the current rules for the Personal AI track: which NVIDIA model families and which Nebius services count, and what evidence is required.
- **Files/modules:** `docs/` (add a short note)
- **Acceptance criteria:** Written note naming the exact eligible model and the evidence the submission needs.
- **Tests required:** None

### SH-04: Freeze the v0 API contract
- **Owner:** Shared | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** Every endpoint has a `response_model`; OpenAPI snapshot `frontend/src/types/openapi.json`; `tests/test_contract.py` fails on drift or untyped JSON endpoints.
- **Depends on:** none (can start now)
- **Description:** Review `docs/API_REFERENCE.md` and `/api/docs`; list changes needed before integration; agree who edits `schemas.py` and `types/api.ts`.
- **Files/modules:** `backend/app/schemas.py`, `frontend/src/types/api.ts`
- **Acceptance criteria:** Contract changes listed; both files agree.
- **Tests required:** Schema tests for any change


## Phase 1: Application shell and backend foundation

### BE-01: Alembic initial migration
- **Owner:** Chirag | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** Revisions 0001 (baseline) and 0002 (`proposed_changes.origin`); app runs `upgrade head` on start; 0.1 databases are stamped then upgraded; `tests/test_migrations.py` (fresh DB matches models, legacy DB keeps data and gains the column, CLI up/down, API on a migrated file DB).
- **Depends on:** none (can start now)
- **Description:** Alembic is scaffolded but has no revision; tables come from `create_all`. Generate the initial revision, run migrations on startup or via a documented command, remove `create_all` from production path.
- **Files/modules:** `backend/migrations/`, `backend/app/db/session.py`, `backend/README.md`
- **Acceptance criteria:** A fresh database is created by `alembic upgrade head`; adding a column via a new revision works on an existing DB.
- **Tests required:** Test that migrates an empty DB and runs the API suite

### SEC-01: Local API session token
- **Owner:** Chirag | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** Per-start token in `.orbit-token`, required on every route but health, constant-time compare, never logged; Vite proxy adds it only for same-origin requests. `tests/test_auth.py`; browser check: direct and cross-site calls get 401.
- **Depends on:** none (can start now)
- **Description:** Any local process can call the API today. Generate a random token at startup, pass it to the frontend (for example via a one-time URL fragment or dev proxy header), require it on every request.
- **Files/modules:** `backend/app/main.py`, `backend/app/api/deps.py`, `frontend/src/lib/api.ts`
- **Acceptance criteria:** Requests without the token get 401; the app works end to end; token is not logged.
- **Tests required:** API tests for 401/200

### FE-01: Typography and design-token review
- **Owner:** Charanjeet | **Priority:** P2 | **Status:** Implemented, needs review
- **Evidence:** IBM Plex self-hosted via `@fontsource` (no CDN). Palette measured: all text pairs ≥ 4.5:1; danger token lightened to pass on raised panels (`docs/UI_UX_GUIDE.md`).
- **Depends on:** none (can start now)
- **Description:** Fonts currently fall back to system fonts. Decide on and self-host the final typefaces (no external CDN at runtime), review the palette against contrast requirements.
- **Files/modules:** `frontend/src/styles/index.css`
- **Acceptance criteria:** All text meets WCAG AA contrast; fonts load offline.
- **Tests required:** Manual contrast check

### FE-02: Responsive and accessibility pass on the shell and all screens
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** Skip link, labelled nav with current page, dialogs with focus management (Cancel first for destructive, focus returns to opener). Browser run: no horizontal scroll at 360/768/1280 on all 8 screens. Tests in `tests/components.test.tsx`. Not done: screen-reader pass, real phones (FE-09).
- **Depends on:** none (can start now)
- **Description:** Check 360px, 768px, 1280px widths; keyboard-only navigation; focus order; dialog focus trapping; screen-reader labels.
- **Files/modules:** `frontend/src/app/Shell.tsx`, `frontend/src/features/*`
- **Acceptance criteria:** Every screen is usable by keyboard alone and at 360px width; no horizontal page scroll.
- **Tests required:** Add component tests for dialogs and nav

### FE-03: Generate TypeScript types from OpenAPI
- **Owner:** Charanjeet | **Priority:** P2 | **Status:** Implemented, needs review
- **Evidence:** `npm run gen:types` (openapi-typescript) → `src/types/generated.ts`; `src/types/api.ts` only aliases it; CI checks the generated file is current.
- **Depends on:** SH-04
- **Description:** Replace hand-written `types/api.ts` with generated types from `/api/openapi.json` (for example `openapi-typescript`) and a script to refresh them.
- **Files/modules:** `frontend/package.json`, `frontend/src/types/`
- **Acceptance criteria:** `npm run gen:types` updates types; typecheck passes.
- **Tests required:** `npm run typecheck`


## Phase 2: Agent, provider integration, and reusable skills

### AI-01: Verify a live Nebius + Nemotron call
- **Owner:** Chirag | **Priority:** P0 | **Status:** Blocked: needs a Nebius API key
- **Evidence:** Ready: `scripts/list_models.py`, `tests/test_live_provider.py` (skipped unless `ORBIT_LIVE_TESTS=1`), bad-key and bad-model checks. Record the working model ID in `.env.example` and `docs/SUBMISSION.md`.
- **Depends on:** SH-03
- **Description:** Create a key, run `scripts/list_models.py`, set `NEBIUS_MODEL` to a real eligible ID, run chat for all four skills. Record which model ID worked and how reasoning output arrives (the provider treats empty `content` as an error).
- **Files/modules:** `.env.example`, `backend/app/providers/nebius.py`, `docs/`
- **Acceptance criteria:** General Q&A returns a validated structured answer from the real model; model ID in `.env.example` is verified; failure modes tested manually (bad key, bad model).
- **Tests required:** Keep mocked tests; add a skipped-by-default live test

### AI-02: Prompt and structured-output reliability for the four built-in skills
- **Owner:** Chirag | **Priority:** P0 | **Status:** Partly done (measurement blocked on AI-01)
- **Evidence:** One repair round naming the invalid fields (`ORBIT_REPAIR_RETRIES`), fixture tests for repair, failed repair, and disabled repair (`tests/test_orchestrator.py`). The 20-prompt live run prints the rate; record it in `docs/AI_AGENT_DESIGN.md`.
- **Depends on:** AI-01
- **Description:** Run 20 varied prompts per skill; measure how often output validates; tune prompts or add one repair retry.
- **Files/modules:** `backend/app/skills/builtin.py`, `backend/app/agent/orchestrator.py`
- **Acceptance criteria:** At least 90% of test prompts validate without fallback (record the measured number).
- **Tests required:** Fixture-based tests for the repair path

### AI-03: Model-based skill routing
- **Owner:** Chirag | **Priority:** P2 | **Status:** Implemented, needs review
- **Evidence:** `ORBIT_MODEL_ROUTING=true`; candidates are enabled chat skills the request may use; unknown/disabled/workflow names ignored; errors fall back to keywords. Tests with a fake provider.
- **Depends on:** AI-01
- **Description:** Keyword routing is a placeholder. Add an optional model call that selects a skill from enabled skills, validated against the registry.
- **Files/modules:** `backend/app/agent/orchestrator.py`
- **Acceptance criteria:** Router never selects a disabled or unknown skill; falls back to keywords on failure.
- **Tests required:** Unit tests with a fake provider

### AI-04: Streaming responses (backend)
- **Owner:** Chirag | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** `POST /api/chat/stream` (SSE: status, token, done, error); reasoning never streamed; final `done` identical in shape to `/api/chat`. `tests/test_streaming.py` (8 tests).
- **Depends on:** AI-01
- **Description:** Add a streaming endpoint (SSE) for the provider; structured validation happens at the end.
- **Files/modules:** `backend/app/api/routes.py`, `backend/app/providers/`
- **Acceptance criteria:** Tokens arrive incrementally; final validated result is identical in shape to `/api/chat`.
- **Tests required:** API test with a fake streaming provider

### FE-04: Streaming chat UI
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** Readable partial answer (main field, not raw JSON) labeled unvalidated, Stop button, inline errors with recovery hints. `tests/chat.test.tsx`.
- **Depends on:** AI-04
- **Description:** Render incremental text, then swap in the structured view when validated; cancel button.
- **Files/modules:** `frontend/src/features/chat/`
- **Acceptance criteria:** Partial text visible within a second; cancel works; errors shown inline.
- **Tests required:** Component test with a mocked stream

### AI-05: Skill: understand a project
- **Owner:** Chirag | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** `project_overview` chat skill: layout + dependency manifests + selected files; needs a workspace; consent covers the layout. Tests in `tests/test_orchestrator.py`, browser routing check.
- **Depends on:** AI-01
- **Description:** New skill that takes the local workspace summary plus a few user-selected files and returns an architecture note. Declares `workspace.read`.
- **Files/modules:** `backend/app/skills/`, `docs/SKILL_DEVELOPMENT.md`
- **Acceptance criteria:** Works on `examples/example-project`; refuses without a workspace; consent dialog still appears.
- **Tests required:** Registration, permission, and demo-output tests


## Phase 3: Memory and structured outputs

### AI-06: Evaluate memory retrieval quality
- **Owner:** Chirag | **Priority:** P2 | **Status:** Implemented, needs review
- **Evidence:** Labeled set of 20 queries / 15 memories: keyword 0.80 recall@3 → stemmed keyword 0.95 (adopted; BM25 tied). `tests/test_memory_eval.py`, `docs/MEMORY_DESIGN.md`.
- **Depends on:** none (can start now)
- **Description:** Keyword overlap is crude. Build a small labeled set of 20 query/memory pairs and compare keyword scoring against BM25 (and embeddings only if justified).
- **Files/modules:** `backend/app/memory/service.py`
- **Acceptance criteria:** Written result with recall numbers; only adopt a change that beats the baseline.
- **Tests required:** Retrieval tests using the labeled set

### AI-07: Memory suggestion quality
- **Owner:** Chirag | **Priority:** P1 | **Status:** Partly done (live check blocked on AI-01)
- **Evidence:** Prompt tightened, plus `vet_suggestion` (grounded in the user's words, no secrets, no sensitive categories). 20 fixtures pass (`tests/test_memory_suggestions.py`). The live 20-prompt check needs the model.
- **Depends on:** AI-01
- **Description:** Tune when the model proposes `suggested_memory` so it only suggests durable facts the user stated, never sensitive guesses.
- **Files/modules:** `backend/app/skills/builtin.py`
- **Acceptance criteria:** On a 20-prompt set, no suggestions are invented or sensitive.
- **Tests required:** Prompt regression fixtures

### FE-05: Memory page filters and bulk actions
- **Owner:** Charanjeet | **Priority:** P2 | **Status:** Implemented, needs review
- **Evidence:** Type/source/status filters combined with search, select + bulk confirm, confirm all shown; each memory stays deletable. Tests in `tests/features.test.tsx`.
- **Depends on:** none (can start now)
- **Description:** Filter by type/source/confirmed; confirm multiple suggestions at once.
- **Files/modules:** `frontend/src/features/memory/`
- **Acceptance criteria:** Filters work together with search; bulk confirm is undoable by delete.
- **Tests required:** Component tests


## Phase 4: Secure workspace and project intelligence

### SEC-03: Broaden secret redaction
- **Owner:** Chirag | **Priority:** P0 | **Status:** Implemented, needs review
- **Evidence:** 8 new patterns (fine-grained GitHub, Stripe, Slack token/webhook, Google API key, npm, Hugging Face, AWS session) + DB-URL passwords, Azure keys, entropy check (measured miss rate ~5% on 32-char tokens, 1% on 43-char). Positive and negative test per pattern. Redaction count shown in consent dialog and on answers.
- **Depends on:** none (can start now)
- **Description:** Add more patterns (cloud keys, database URLs with passwords, Slack/Stripe tokens) and an entropy check for long random strings; document false-positive trade-offs.
- **Files/modules:** `backend/app/security/redaction.py`, `backend/tests/test_redaction.py`
- **Acceptance criteria:** Each new pattern has a positive and a negative test; redaction count shown in UI.
- **Tests required:** Extend `test_redaction.py`

### SEC-04: Close the check-then-write window
- **Owner:** Chirag | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** POSIX: directory fds + `O_NOFOLLOW` walk, `O_EXCL` temp file, `rename` within the dir fd; Windows: re-verify before replace. Post-write hash check. Symlink-swap test passes on Linux (WSL); the original code wrote outside the workspace in the same scenario.
- **Depends on:** none (can start now)
- **Description:** Writes resolve the path, then write. Open with `O_NOFOLLOW`/use directory file descriptors where available, and re-verify after open.
- **Files/modules:** `backend/app/workspace/service.py`
- **Acceptance criteria:** A test that swaps a symlink between check and write cannot escape.
- **Tests required:** Race/symlink test

### BE-03: Project question answering with ranked retrieval
- **Owner:** Chirag | **Priority:** P0 | **Status:** Implemented, needs review
- **Evidence:** `GET /workspaces/{id}/suggest`: file-name + BM25 content ranking with reasons, local only; user picks files in chat or the agent; consent still applies. `tests/test_retrieval.py`, `tests/features.test.tsx`.
- **Depends on:** AI-01
- **Description:** Today the user selects files. Add retrieval that proposes the most relevant authorized files for a question (filename + content scoring), shows them to the user, and sends only the files they confirm.
- **Files/modules:** `backend/app/workspace/service.py`, `backend/app/agent/orchestrator.py`, `frontend/src/features/chat/`
- **Acceptance criteria:** Asking about the example project proposes relevant files; nothing is sent without the consent dialog.
- **Tests required:** Retrieval and consent tests

### FE-06: File tree and diff viewer
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** Collapsible tree (folders closed by default; 1,000 files render 20 folder rows), line diff with numbers, +/− stats, folded unchanged runs. Tests in `tests/components.test.tsx`, `tests/lib.test.ts`.
- **Depends on:** none (can start now)
- **Description:** Collapsible folder tree; side-by-side or inline diff for proposed changes with line highlights.
- **Files/modules:** `frontend/src/features/projects/`
- **Acceptance criteria:** Large trees stay responsive; diff clearly shows additions and removals.
- **Tests required:** Component tests

### AI-08: AI-drafted file changes
- **Owner:** Chirag | **Priority:** P2 | **Status:** Implemented, needs review
- **Evidence:** `POST /workspaces/{id}/draft`: secrets sent as numbered placeholders and restored locally, line endings preserved, identical/unusable drafts rejected, proposal labeled AI draft with diff, stale-hash check unchanged. `tests/test_agent.py`, browser check.
- **Depends on:** AI-01, BE-03
- **Description:** Let the model draft `new_content` for a user's request; it must still enter the proposal and approval flow.
- **Files/modules:** `backend/app/skills/`
- **Acceptance criteria:** Drafts never write; proposal shows a visible diff; stale-hash check still applies.
- **Tests required:** Skill and approval tests

### SEC-02: Folder selection without typing paths
- **Owner:** Shared | **Priority:** P2 | **Status:** Implemented, needs review
- **Evidence:** Typed-path limitation documented (`docs/WORKSPACE_ACCESS.md`, `docs/DEPLOYMENT.md`, hint on the Projects screen). A native picker depends on the Tauri decision.
- **Depends on:** IN-04
- **Description:** A browser can't pick absolute paths. Use a native folder dialog once packaged (Tauri) or document the typed-path limitation.
- **Files/modules:** `frontend/`, packaging config
- **Acceptance criteria:** Folder picker returns a path validated by the backend as today.
- **Tests required:** Manual


## Phase 5: Visual Learning Studio

### FE-07: Scene polish and verification
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Partly done
- **Evidence:** Verified in Edge: renders, no-WebGL message (WebGL disabled), camera presets (overview/top/front), labels enlarged and region labels moved off components. Not yet tried on phones or a mid-range laptop's GPU.
- **Depends on:** none (can start now)
- **Description:** Open the scene in real browsers and phones, fix label overlap, camera presets, performance; verify the WebGL error state.
- **Files/modules:** `frontend/src/features/visual-learning/`
- **Acceptance criteria:** Smooth interaction on a mid-range laptop; error state shows when WebGL is disabled.
- **Tests required:** Manual checklist items

### FE-08: Second curated scene
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** Event-driven serverless scene (10 parts, steps 1–10) enabled; data-integrity tests now run for every scene.
- **Depends on:** none (can start now)
- **Description:** Build one more scene (for example event-driven serverless) with explanations; enable it in `subjects`.
- **Files/modules:** `frontend/src/features/visual-learning/scenes.ts`
- **Acceptance criteria:** Scene passes the data integrity test; step-by-step mode works.
- **Tests required:** Existing data tests

### CV-01: Marker-based subject recognition prototype
- **Owner:** Chirag | **Priority:** P2 | **Status:** Implemented, needs review
- **Evidence:** ArUco markers (ARUCO_MIP_36h12, ids 1–2) detected in the browser with js-aruco2; 3 consecutive frames needed; nothing stored or uploaded. Unit test on synthetic marker images; browser test feeds the fake camera a marker video and the scene switches. Printable markers at `/visual/markers`. Not tried with a physical webcam.
- **Depends on:** FE-08
- **Description:** Recognize printed markers (for example ArUco) with OpenCV or a browser library to select a curated scene. Do not claim general object recognition.
- **Files/modules:** new module under `backend/` or `frontend/src/features/visual-learning/`
- **Acceptance criteria:** Showing a marker selects the right scene; no frames are stored or uploaded.
- **Tests required:** Unit test on sample images

### CV-02: Gesture control with MediaPipe
- **Owner:** Charanjeet | **Priority:** P2 | **Status:** Not Started
- **Evidence:** Deferred: needs a real camera and hand to verify, and the MediaPipe model (~8 MB) bundled for offline use.
- **Depends on:** none (can start now)
- **Description:** Optional hand gestures for rotate/zoom, opt-in and processed in the browser.
- **Files/modules:** `frontend/src/features/visual-learning/`
- **Acceptance criteria:** Works when enabled; off by default; camera indicator remains visible.
- **Tests required:** Manual

### AI-09: AI explanation of a selected component
- **Owner:** Chirag | **Priority:** P2 | **Status:** Implemented, needs review
- **Evidence:** `POST /api/learn/explain` with the `explain_component` skill; labeled AI-generated with the model name, curated text when demo/unconfigured. Backend and frontend tests.
- **Depends on:** AI-01
- **Description:** Endpoint that expands the curated description for a component using the model, labeled as AI-generated.
- **Files/modules:** `backend/app/skills/`, `frontend/src/features/visual-learning/`
- **Acceptance criteria:** Output labeled AI-generated; falls back to curated text when unconfigured.
- **Tests required:** Skill tests


## Phase 6: Frontend-backend integration

### IN-01: End-to-end chat with the real provider
- **Owner:** Shared | **Priority:** P0 | **Status:** Blocked: needs AI-01
- **Evidence:** The chat loop is verified in the browser in demo mode (streaming, routing, tasks); repeat with a real key.
- **Depends on:** AI-01, FE-02
- **Description:** Run the full chat loop in the browser against Nebius; fix any contract mismatches.
- **Files/modules:** `frontend/src/features/chat/`, `backend/`
- **Acceptance criteria:** Smoke checklist chat items pass with a real key.
- **Tests required:** Manual checklist

### IN-02: End-to-end workspace and approval flows
- **Owner:** Shared | **Priority:** P0 | **Status:** Partly done (hosted part blocked on AI-01)
- **Evidence:** Demo-mode browser run: authorize, `.env` hidden, propose, refused without writes, approved with writes and verified. Consent and redaction with a hosted model are covered by API tests with a fake model; repeat live.
- **Depends on:** AI-01
- **Description:** Authorize the example project, explain a file with the hosted provider, redaction visible, consent dialog, propose and approve a change.
- **Files/modules:** `frontend/src/features/projects/`, `backend/app/api/`
- **Acceptance criteria:** Smoke checklist workspace items pass.
- **Tests required:** Manual checklist

### IN-03: Failure-state pass
- **Owner:** Shared | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** Every error code maps to a title and a recovery step (`src/lib/errors.ts`); retry only where it helps; links to Settings/Skills/Projects. Component tests for 6 cases; screens show errors instead of misleading empty states.
- **Depends on:** IN-01
- **Description:** Backend down, bad key, rate limit, empty reasoning response, oversized file: each shows a useful message.
- **Files/modules:** `frontend/src/components/ui.tsx`, features
- **Acceptance criteria:** Each failure produces a clear, non-technical message and recovery action.
- **Tests required:** Component tests for ErrorState cases

### IN-04: Decide packaging: local web vs Tauri
- **Owner:** Shared | **Priority:** P2 | **Status:** Proposed, needs team decision
- **Evidence:** `docs/DEPLOYMENT.md`: local web app for the demo, Tauri as a stretch goal, Docker rejected (cannot see unmounted folders). Rationale recorded.
- **Depends on:** none (can start now)
- **Description:** Decide and document how the app will ship for the demo; do not build a pipeline unless needed.
- **Files/modules:** `docs/`
- **Acceptance criteria:** Decision recorded with rationale.
- **Tests required:** None


## Phase 7: Testing, security review, and documentation

### QA-01: Backend quality gates in CI
- **Owner:** Chirag | **Priority:** P1 | **Status:** Partly done
- **Evidence:** CI: ruff on app/tests/examples, coverage gate 85% (measured ~92%), contract checks. Format checking not added: `ruff format` would rewrite the team's compact style across every file; decide together, then add `ruff format --check`.
- **Depends on:** none (can start now)
- **Description:** Add coverage reporting and format checking to CI; keep ruff clean.
- **Files/modules:** `.github/workflows/ci.yml`, `backend/pyproject.toml`
- **Acceptance criteria:** CI fails on lint, test, or coverage regression.
- **Tests required:** CI run

### QA-02: Frontend integration tests
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** MSW fake backend; Home, Memory, Skills, Tasks, Projects and Settings each tested in loading, empty, error and success states (24 tests); Chat covered in `tests/chat.test.tsx`.
- **Depends on:** FE-02
- **Description:** Add tests that render pages against a mocked API (for example MSW) covering empty, loading, error, and success states.
- **Files/modules:** `frontend/tests/`
- **Acceptance criteria:** Each primary screen has tests for all four states.
- **Tests required:** `npm test`

### SEC-05: Security review and prompt-injection tests
- **Owner:** Shared | **Priority:** P0 | **Status:** Partly done (live run blocked on AI-01)
- **Evidence:** 5 injection fixtures; offline tests found and fixed a fence weakness (a file could inject a second `<user_request>`); model output cannot trigger tools. Live harness ready; results table in `docs/THREAT_MODEL.md`.
- **Depends on:** AI-02
- **Description:** Walk through `docs/THREAT_MODEL.md`; write test documents containing injected instructions and run them against the real model; record results honestly.
- **Files/modules:** `backend/tests/`, `docs/THREAT_MODEL.md`
- **Acceptance criteria:** Documented results; any bypass found has a fix or a documented limitation.
- **Tests required:** New injection fixtures

### DOC-01: Write the remaining documents
- **Owner:** Shared | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** Written: PROJECT_OVERVIEW, DATA_FLOW, DATABASE_SCHEMA, AI_AGENT_DESIGN, MEMORY_DESIGN, UI_UX_GUIDE, DEPLOYMENT, TROUBLESHOOTING, HACKATHON, DEMO_SCRIPT, SUBMISSION, plus a README in each backend package; existing docs updated; all linked from the README. docker-compose not added (see IN-04).
- **Depends on:** none (can start now)
- **Description:** Not yet written: `PROJECT_OVERVIEW`, `DATA_FLOW`, `DATABASE_SCHEMA`, `AI_AGENT_DESIGN`, `MEMORY_DESIGN`, `UI_UX_GUIDE`, `DEPLOYMENT`, `TROUBLESHOOTING`, plus `docker-compose.yml` if wanted. Per-folder READMEs for each backend package.
- **Files/modules:** `docs/`
- **Acceptance criteria:** Each document is accurate to the code and links from the README.
- **Tests required:** Doc review

### QA-03: Run the manual smoke checklist
- **Owner:** Shared | **Priority:** P0 | **Status:** Partly done
- **Evidence:** Automated: `npm run e2e` (26 checks, all pass in Edge, demo mode). Manual items that need a key, a webcam or phones are marked in `docs/TESTING.md`.
- **Depends on:** IN-02, FE-07
- **Description:** Execute every item in `docs/TESTING.md` on a clean checkout and record failures as tasks.
- **Files/modules:** `docs/TESTING.md`
- **Acceptance criteria:** All items pass or have an open task.
- **Tests required:** Manual


## Phase 8: Hackathon demo and submission

### DEMO-01: Demo script and sample project
- **Owner:** Shared | **Priority:** P0 | **Status:** Partly done
- **Evidence:** Script drafted in `docs/DEMO_SCRIPT.md` (3 min, fallback plan). Needs AI-01 and two rehearsals by the team.
- **Depends on:** QA-03
- **Description:** Write a 3-minute demo script using `examples/example-project`, with a fallback if the network fails.
- **Files/modules:** `docs/` (demo script)
- **Acceptance criteria:** Two full rehearsals run without surprises.
- **Tests required:** Rehearsal

### DEMO-02: Backup demo video
- **Owner:** Charanjeet | **Priority:** P1 | **Status:** Not Started
- **Evidence:** Needs DEMO-01 and a live key; must show real model output.
- **Depends on:** DEMO-01
- **Description:** Record a clean run in case of live failure.
- **Files/modules:** outside repo
- **Acceptance criteria:** Video under 3 minutes showing real (not demo-mode) model output.
- **Tests required:** Review

### DEMO-03: Submission write-up with provider evidence
- **Owner:** Chirag | **Priority:** P0 | **Status:** Partly done
- **Evidence:** Draft in `docs/SUBMISSION.md` with local-vs-Nebius table and limitations; fill in model ID and evidence after AI-01.
- **Depends on:** AI-01, SEC-05
- **Description:** Describe truthfully what runs locally vs on Nebius, which model, and what is not implemented. Include evidence of Nebius usage that the rules require.
- **Files/modules:** `README.md`, submission form
- **Acceptance criteria:** Every claim maps to working code; limitations listed.
- **Tests required:** Cross-check against the README status table

### DEMO-04: One-command start
- **Owner:** Chirag | **Priority:** P2 | **Status:** Implemented, needs review
- **Evidence:** `python scripts/dev.py [--demo]`: installs missing deps, creates `.env`, starts both servers, waits until each answers, stops both on Ctrl+C. Verified on Windows; `dev.sh` kept for macOS/Linux.
- **Depends on:** SH-02
- **Description:** Provide `docker-compose.yml` or a single script for both services if time allows.
- **Files/modules:** `docker-compose.yml`
- **Acceptance criteria:** A fresh machine starts the app with one command.
- **Tests required:** Manual


## Added from the product vision (2026-10-15)

### AG-01: Project agent workflow (read → analyze → draft → propose → remember)
- **Owner:** Chirag (backend), Charanjeet (UI) | **Priority:** P0 | **Status:** Implemented, needs review
- **Evidence:** `POST /api/workspaces/{id}/agent/notes` and the Project agent panel: suggested files, consent, five visible steps, Markdown notes rendered by code, a proposal (never a direct write), approval with verified write, an unconfirmed project memory (reused, never duplicated). `tests/test_agent.py`, `tests/features.test.tsx`, browser run.
- **Description:** The vision's flagship workflow ("understand my project, write notes, save them after I approve, remember the context"), built as a fixed pipeline with approval gates instead of an open-ended tool loop.

### CH-01: Conversation history in the prompt
- **Owner:** Chirag | **Priority:** P0 | **Status:** Implemented, needs review
- **Evidence:** The last 6 messages of a conversation go with each follow-up; `test_follow_up_includes_earlier_turns`.

### AI-10: Learn-a-topic skill
- **Owner:** Chirag | **Priority:** P1 | **Status:** Implemented, needs review
- **Evidence:** `learn_topic`: explanation, plain-text diagram, real-world example, key points, interview questions; routes from "explain … like I'm a beginner … diagram … interview questions". Backend test and browser run.

### FE-09: Screen-reader and phone pass
- **Owner:** Charanjeet | **Priority:** P2 | **Status:** Not Started
- **Description:** Walk every screen with NVDA or VoiceOver, and open the app on a real phone over the local network (needs `--host` and a CORS origin). Fix what you find.

### SEC-06: Close the Windows check-then-write window
- **Owner:** Chirag | **Priority:** P2 | **Status:** Not Started
- **Description:** Windows has no `O_NOFOLLOW`/dir-fd writes in Python; the current path re-verifies before replacing. Options: open the parent with `FILE_FLAG_OPEN_REPARSE_POINT` via `ctypes`, or refuse writes under any reparse point.
