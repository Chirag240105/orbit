# Testing

```bash
cd backend && pytest -q && ruff check app tests
cd frontend && npm run typecheck && npm test && npm run build
cd backend && pytest ../examples/example-skill -q
```
Backend tests use an in-memory SQLite database, a mocked HTTP transport for the provider, and temp folders. No real credentials or personal files are used.

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
- [ ] Kill the backend: pages show "Backend not reachable".
