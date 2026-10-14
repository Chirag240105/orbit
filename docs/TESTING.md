# Testing

```bash
cd backend && pytest -q --cov=app && ruff check app tests ../examples   # ~160 tests, coverage gate 85% (pyproject.toml)
cd backend && pytest ../examples/example-skill -q
cd frontend && npm run typecheck && npm test && npm run build           # ~85 tests
cd frontend && npm run gen:types && git diff --exit-code src/types/generated.ts   # contract in sync (CI runs this)
```

**Backend** tests use in-memory SQLite (created through the real Alembic migrations), a scripted fake model behind `httpx.MockTransport` (`tests/conftest.py: FakeModel, hosted()`), and temp folders. No real credentials or personal files. Symlink tests skip on Windows accounts without the symlink privilege; they run on Linux (CI, or WSL: see below).

**Frontend** tests use jsdom and MSW (`tests/helpers.tsx`) as a fake backend: every primary screen is tested in its loading, empty, error and success states (`tests/screens.test.tsx`). `tests/setup.ts` contains a test-only shim so `AbortController` works with Node's fetch under jsdom.

## Live model tests (need `NEBIUS_API_KEY` in `.env`; skipped otherwise)
```bash
cd backend
ORBIT_LIVE_TESTS=1 pytest tests/test_live_provider.py -s   # AI-01/AI-02: 20 prompts across 4 skills, prints the validation rate
ORBIT_LIVE_TESTS=1 pytest tests/test_injection.py -s       # SEC-05: injection fixtures against the real model
```
Record the numbers in `AI_AGENT_DESIGN.md` and `THREAT_MODEL.md`.

## Browser smoke test (QA-03), automated
Covers most of the manual checklist below in a real browser (Edge by default; `ORBIT_E2E_CHANNEL=chrome` for Chrome):
```bash
ORBIT_DATABASE_URL=sqlite:///./e2e.db python scripts/dev.py --demo     # terminal 1, from the repo root
cd frontend && npm run e2e                                               # terminal 2; screenshots in frontend/e2e/shots/
```
It checks the API token, folder authorization and `.env` hiding, AI drafts, the project agent (refused without write access, written and verified with it), chat routing, tasks, memory filters, WebGL rendering, the camera indicator, **marker recognition from a fake camera video**, the no-WebGL message, and no horizontal scroll at 360/768/1280 px on every screen. Last run: 26/26 passed (Edge 155, Windows 11).

## Linux-only tests from Windows (WSL)
```bash
wsl -d Ubuntu -- bash -lc "python3 -m venv ~/orbit-venv && ~/orbit-venv/bin/pip install fastapi uvicorn sqlalchemy alembic pydantic pydantic-settings httpx pytest && cd /mnt/d/path/to/orbit/backend && ~/orbit-venv/bin/python -m pytest -q -p no:cacheprovider tests/test_write_safety.py tests/test_policy.py"
```

## Manual smoke checklist (run before a demo)
Items marked (auto) are covered by `npm run e2e` in demo mode; repeat the others by hand with a real key.
- [ ] Backend starts; `/api/health` is `ok`; top bar shows the right provider state. (auto, demo)
- [ ] Unconfigured: chat shows the setup banner and Send is disabled. (frontend test)
- [ ] With a real key: ask a question and get a validated answer (not labeled demo). Streaming text appears within a second; Stop works.
- [ ] Authorize `examples/example-project`; `.env` is not listed and not readable. (auto)
- [ ] Explain `app.py` with a hosted provider: consent dialog appears; the secret-looking token is redacted.
- [ ] Propose a change: nothing written. Approve with writes off: refused. Turn writes on, approve: written. (auto)
- [ ] Project agent with a hosted provider: consent dialog lists files and layout; notes proposal appears; approve writes it.
- [ ] Memory: add, edit, search, filter, confirm a suggested one, delete one, delete all. (partly auto)
- [ ] Tasks: plan in chat, send to Tasks, approve, move to done. (partly auto)
- [ ] Visual Learning: scene loads, rotate/zoom/pan, select, isolate, presets, step mode; camera start shows indicator, stop turns it off; a printed marker switches scene; denying permission shows a clear message. (mostly auto, fake camera; try a real webcam and paper marker)
- [ ] Kill the backend: pages show "Backend not reachable" with a recovery hint. (frontend test)
