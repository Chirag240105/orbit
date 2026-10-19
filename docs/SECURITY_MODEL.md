# Security model: controls and status

Legend: **Done** = code + automated tests. **Done (untested here)** = code exists, not exercised by tests. **Planned** = not built.

| Control | Status | Where |
|---|---|---|
| Account password hashing and signed bearer sessions | Implemented (bcrypt password verifier, HS256 JWT); deployment must set `ORBIT_JWT_SECRET` | `auth.py`, `/api/auth/*` |
| User ownership on stored records | Implemented; ORM query criteria and insert ownership check, cross-user API test | `db/session.py`, `models.py`, `tests/test_auth.py` |
| Authentication rate limit | Implemented (10 auth requests/IP/minute) | `auth.py`, `core/ratelimit.py` |
| Path traversal / absolute path rejection | Done | `workspace/policy.py`, `tests/test_policy.py` |
| Symlink escape protection | Done | same |
| Sensitive file exclusion (`.env`, keys, credentials) | Done | same, `tests/test_workspace_api.py` |
| Extension allowlist, size limit, binary rejection | Done | same |
| Read-only by default, write needs per-workspace opt-in + per-change approval | Done | `tools/registry.py`, API tests |
| Stale-change detection | Done | `tools/registry.py` |
| Secret redaction before external send | Done (best effort) | `security/redaction.py`, `tests/test_redaction.py` |
| Consent before sending file text to a hosted model | Done | `agent/orchestrator.py`, `tests/test_provider_consent.py` |
| Untrusted-content fencing | Done | `security/redaction.py` |
| Schema validation of tool inputs and model output | Done | `tools/registry.py`, `agent/orchestrator.py` |
| Permission check on every skill/tool call (backend) | Done | orchestrator, `execute_tool` |
| Audit log (metadata only) | Done | `audit/log.py` |
| Rate limit | Done (in-memory, per IP) | `core/ratelimit.py` |
| Generic client errors | Done | `core/errors.py` |
| Strict CORS | Done | `main.py`, `tests/test_api.py` |
| Startup config validation | Partial: URL and ranges validated; no check that the key works | `config.py` |
| Model-driven tool calling with approvals | Planned, intentionally disabled | — |
| Encrypted database | Planned | — |

Redaction is pattern-based and will miss some secrets. Treat the consent dialog as the real control.
