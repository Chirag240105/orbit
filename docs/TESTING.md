# Testing

```bash
cd backend && pytest -q && ruff check app tests
cd frontend && npm run typecheck && npm test && npm run build
cd backend && pytest ../examples/example-skill -q
```
Backend tests use an in-memory SQLite database, a mocked HTTP transport for the provider, and temp folders. No real credentials or personal files are used. Frontend tests include scene-data integrity tests for all curated scenes.

## Manual smoke checklist (run before a demo)
- [ ] Backend starts; `/api/health` is `ok`; top bar shows the right provider state.
- [ ] Unconfigured: chat shows the setup banner and Send is disabled.
- [ ] With a real key: ask a question and get a validated answer (not labeled demo).
- [ ] Authorize `examples/example-project`; `.env` is not listed and not readable.
- [ ] Explain `app.py` with a hosted provider: consent dialog appears; the secret-looking token is redacted.
- [ ] Propose a change: nothing written. Approve with writes off: refused. Turn writes on, approve: written.
- [ ] Memory: add, edit, search, confirm a suggested one, delete one, delete all.
- [ ] Tasks: plan in chat, send to Tasks, approve, move to done.
- [ ] Visual Learning: scene loads, rotate/zoom/pan, select, isolate, reset, step mode; camera start shows indicator, stop turns it off; denying permission shows a clear message.
- [ ] Visual Learning — Amazon e-commerce scene: switch to the Amazon-like tab, open the system-design overview, select a component, verify structured content (APIs, data model, scaling, failure modes) appears.
- [ ] Visual Learning — pinch-to-grab: start camera, pinch and move your hand to rotate the scene; release to stop rotating.
- [ ] System-design chat: ask "Explain the system design of Amazon" — the system_design skill is selected and returns a structured answer with key points, risks, and follow-ups.
- [ ] A11: A case-insensitive repository scan for removed provider names and key markers returns no matches; startup and a live chat work with only the NVIDIA API key configured.
- [ ] Kill the backend: pages show "Backend not reachable".
