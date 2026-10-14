# Threat model

| Boundary | Trust | Main threats | Mitigations (status) |
|---|---|---|---|
| Frontend ↔ backend | Local, single user | Other sites calling the API; other local processes; DNS rebinding | CORS allowlist, no wildcard, no credentials; binds `127.0.0.1`; per-start API token required on every route except health, added by the dev proxy only for same-origin requests (**implemented, tested, verified in Edge**) |
| Backend ↔ model provider | Hosted, untrusted | Data exposure; key leak; hostile output | Key only in backend env; HTTPS-only URL validation; consent before file text or project layout is sent; redaction; output validated against schema; provider errors made generic (**implemented, tested with mocks**). Live provider call **not yet verified (AI-01, needs a key)** |
| Model output | Untrusted | Prompt injection causing actions; malicious commands in text | No shell/subprocess in the app; the model never chooses tools; the agent is fixed code; every write needs a human approval; output is only rendered as text (**implemented; `test_model_output_cannot_trigger_tools`**) |
| Retrieved files / memories / layout | Untrusted data | Injected instructions ("ignore previous rules…"), fake prompt structure | Fenced in `<untrusted_data>`; `</untrusted_data>`, `<untrusted_data` and `<user_request>` inside content are escaped; system preamble says data ≠ instructions (**implemented; 5 injection fixtures pass offline. A real fixture found that a file could inject a second `<user_request>` block; fixed. Effect on Nemotron itself untested: run `ORBIT_LIVE_TESTS=1 pytest tests/test_injection.py` and record results below**) |
| AI-drafted file changes | Untrusted | Secret loss, hidden edits | Secrets replaced by numbered placeholders before sending and restored locally; warning if a placeholder survives; diff shown; approval required; stale-hash check (**implemented, tested**) |
| Workspace files | User-authorized only | Path traversal, symlink escape, secret exposure, unwanted writes, check-then-write races | Absolute-path/`..` rejection, `realpath` containment, exclusion list, extension allowlist, size limit, read-only default, approval + `allow_write` + stale-hash check, race-safe writes on POSIX, post-write hash verification (**implemented, unit, API and Linux race tested**). Windows write path re-verifies but cannot fully close the race |
| Memory store | Local DB | Poisoned, invented or sensitive memories; leakage via prompts | Only confirmed memories are used; model suggestions must be grounded in the user's own words and pass secret and sensitive-category filters; agent suggestions start unconfirmed; delete one/all (**implemented, 20 fixtures**) |
| Tool execution | Backend only | Privilege escalation via a new tool/skill | Registered ≠ permitted: permissions checked per call; writes need confirmation (**implemented**) |
| Camera | Browser-controlled | Silent capture; upload | Starts only on click; visible indicator; marker detection is opt-in and runs on an in-memory canvas; no recording or upload code exists (**implemented; verified in Edge with a fake camera; not on a physical device**) |
| Logs / audit | Local | Secrets in logs | Audit stores metadata only; unhandled errors log the exception type only; the API token is never logged (**implemented, tested**) |

## Live injection results (SEC-05)
Not run yet: it needs `NEBIUS_API_KEY`. Fill this table after `ORBIT_LIVE_TESTS=1 pytest tests/test_injection.py -s`.

| Fixture | Model followed the injection? | Notes |
|---|---|---|
| ignore_previous.md | | |
| fake_system.py | | |
| fence_break.md | | |
| tool_request.md | | |
| exfiltrate.md | | |

## Out of scope for the MVP
Multi-user auth, remote deployment hardening, encrypted-at-rest database, malware in authorized folders, a compromised local machine (anything running as you can read `.orbit-token`).
