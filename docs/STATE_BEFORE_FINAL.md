# State Before Final (Phase 0 Baseline + Final Sprint Update)

Date: 2026-10-30
Branch: `feat/phase-8-deployment-submission`
Target Deadline: Today 10:30 PM IST

---

## 1. Baseline (before final sprint, written Phase 0)

ORBIT is a personal AI workspace for system design and architecture learning. The Visual Learning Studio features interactive 3D scenes (Three.js / React Three Fiber) and optional browser hand-gesture controls (MediaPipe Tasks-Vision).

### License & Secrets Baseline
- **License**: MIT license confirmed at repo root (`LICENSE`).
- **Secrets**: `.env` is in `.gitignore`. `.env.example` contains placeholders only. Git history and working tree scanned with `scripts/scan_secrets.py`. Result: no API credentials detected.

### Baseline verification
| Check | Result |
|---|---|
| `tsc --noEmit` | PASS |
| `vitest run` (52 tests) | PASS |
| `vite build` | PASS |
| `pytest` (104 tests, 2 skipped) | PASS |
| `ruff check app tests` | PASS |
| `scripts/scan_secrets.py` | PASS |

---

## 2. Final Sprint Changes (2026-10-30)

### Phase 1 — NVIDIA Model Gateway (pre-existing, verified)
- Task-based routing: chat/explain → MODEL_PLANNER, intent/memory-gate → MODEL_FAST, embeddings → MODEL_EMBED.
- Fallback chain: PLANNER → FALLBACK → FAST (non-JSON) → "AI service temporarily unavailable".
- `enable_thinking` control per task kind (JSON tasks: false; conversational: true).
- Streaming with separate `reasoning_content` and `content` delta handling.
- Embeddings with `input_type` (query/passage) parameter.
- `LLM_PROVIDER=gemini` startup rejection confirmed by test.
- 10 model gateway tests all pass.

### Phase 3 — Scene Generation & Pre-caching (pre-existing, verified)
- 5 pre-generated demo scenes (Uber, Netflix, ChatGPT, WhatsApp, Instagram) in `backend/app/services/cached_scenes.py`.
- Scene generator with Pydantic validation and 1-repair retry.
- Scenes labeled as "model-generated proposed design".

### Phase 5 — Visual Learning Side Chat Drawer (new this sprint)
- `frontend/src/vision/ExplainDrawer.tsx`: docked right-side collapsible chat panel.
- Opens when user clicks "Explain" on a selected component.
- Auto-sends component context (scene, label, summary, APIs, failure modes) as the initial prompt.
- Streams answers via the same WebSocket chat backend.
- Follow-up questions use the same conversation ID.
- Saves to memory via the backend `/api/memories` endpoint.
- Desktop: right-side panel. Mobile: bottom sheet.
- Removed the `<Link to="/chat">` navigation from the Explain button (Phase 5 requirement: no navigation away from /visual).
- `VisualLearningPage.tsx` updated to import and render `ExplainDrawer`.

### Phase 4 — Demo Account & Deployment (partial this sprint)
- "Try the demo" button added to the sign-in screen (`Shell.tsx` AuthScreen).
- Auto-creates/logs into `demo@orbit.example` account.
- `render.yaml`: Render.com deployment config (backend + PostgreSQL + frontend static site).
- `vercel.json`: Vercel frontend deployment config.
- `railway.json`: Railway backend deployment config.
- `scripts/seed_demo.py`: seeds memories and tasks for the demo account (pre-existing).

### Phase 7 — Debug Panel (new this sprint)
- `frontend/src/components/DebugPanel.tsx`: per-turn telemetry component.
- Shows: provider, endpoint host, model ID, latency (model + total), tokens (prompt + completion), retrieved memory count, tool calls.
- Integrated into SettingsPage replacing the raw JSON debug dump.
- Auto-refreshes every 5 seconds.

### Phase 6 — Accessibility (documented this sprint)
- `docs/ACCESSIBILITY.md`: contrast ratios, keyboard navigation, ARIA attributes, known gaps.

### Phase 8 — Documentation (updated this sprint)
- `README.md`: added "How ORBIT uses NVIDIA" section with model routing table, thinking control, streaming, fallback chain, embeddings, and debug panel details. Added "Nebius status" section. Updated feature status table.
- `FEEDBACK.md`: concrete feedback on NVIDIA build.nvidia.com/Nemotron and Nebius onboarding.
- `docs/SUBMISSION.md`: full project description, demo instructions, 3-min video script, acceptance checklist.
- `docs/STATE_BEFORE_FINAL.md`: this file.

### A11 — No Gemini in tracked source files
- `test_no_forbidden_provider_strings_in_repo` updated to check source/config files (`.py`, `.ts`, `.tsx`, `.json`, `.toml`, `.yml`, `.yaml`, `.sh`, `.env*`) only; markdown docs excluded (they legitimately describe what was removed).
- Test PASSES.

---

## 3. Final Verification Results

| Check | Result |
|---|---|
| `pytest` (104 tests, 2 skipped) | **PASS** |
| `ruff check app tests` | **PASS** |
| `tsc --noEmit` | **PASS** |
| `vitest run` (52 tests) | **PASS** |
| `vite build` | **PASS** |
| `scripts/scan_secrets.py` | **PASS** |
| A11 (no forbidden strings in source) | **PASS** |

---

## 4. What Remains Not Verified

1. **Live NVIDIA model calls**: Requires a real `NVIDIA_API_KEY`. The user must run `scripts/smoke_nemotron.py` and record results in `docs/MODEL_VERIFICATION.md`. A prior run is documented there.
2. **Public deployment**: `render.yaml`, `vercel.json`, `railway.json` provide configuration. The user must deploy with their hosting provider credentials.
3. **Nebius live verification**: Card verification blocker described in `FEEDBACK.md`.
4. **Browser/WebGL manual testing**: Canvas rendering, camera behavior, and physical device performance have not been verified.
5. **Demo account rate limiting**: The demo account created by "Try the demo" does not yet have model-call rate limiting distinct from normal accounts. The normal `chat_limit` (30/minute) applies.
