# Security model: controls and status

Legend: **Done** = code + automated tests. **Done (partly verified)** = code and tests exist, with the gap named. **Planned** = not built.

| Control | Status | Where |
|---|---|---|
| Path traversal / absolute path rejection | Done | `workspace/policy.py`, `tests/test_policy.py` |
| Symlink escape protection | Done (symlink tests run on Linux/CI; Windows skips them without the privilege) | same |
| Check-then-write race (directory swapped for a symlink) | Done on POSIX: directory fds + `O_NOFOLLOW` (verified in WSL Ubuntu; the original code wrote outside the workspace in the same test). Windows: re-verified before replace, a narrower window, not closed | `workspace/service.py`, `tests/test_write_safety.py` |
| Written file verified (hash) after every approved write | Done | `workspace/service.py` |
| Sensitive file exclusion (`.env`, keys, credentials, `*secret*`) | Done | `workspace/policy.py`, `tests/test_workspace_api.py` |
| Extension allowlist, size limit, binary rejection | Done | same |
| Read-only by default, write needs per-workspace opt-in + per-change approval | Done | `tools/registry.py`, API tests, browser run |
| Stale-change detection | Done | `tools/registry.py` |
| Secret redaction before external send | Done (best effort): 15 patterns incl. cloud, Slack, Stripe, npm, HF, DB-URL passwords, plus an entropy check | `security/redaction.py`, `tests/test_redaction.py` |
| Secrets never sent when the model drafts a file; restored locally | Done (numbered placeholders) | `agent/workflows.py`, `tests/test_agent.py` |
| Consent before sending file text **or the project layout** to a hosted model | Done | `agent/orchestrator.py`, chat/agent/draft tests, browser run |
| Untrusted-content fencing (content cannot close the fence or fake `<user_request>`) | Done | `security/redaction.py`, `tests/test_injection.py` |
| Schema validation of tool inputs and model output | Done | `tools/registry.py`, `agent/orchestrator.py` |
| Permission check on every skill/tool call; memories only for skills that declare `memory.read` | Done | orchestrator, `execute_tool` |
| Suggested memories: grounded in the user's words, no secrets, no sensitive categories, unconfirmed until the user confirms | Done | `memory/service.py`, `tests/test_memory_suggestions.py` |
| Local API token (SEC-01) | Done: per-start random token, required on every route except health, compared in constant time, never logged; the dev proxy adds it only for same-origin requests | `api/deps.py`, `main.py`, `frontend/vite.config.ts`, `tests/test_auth.py`, browser run |
| Audit log (metadata only) | Done | `audit/log.py` |
| Rate limit on model-calling endpoints | Done (in-memory, per IP, per app) | `core/ratelimit.py` |
| Generic client errors (no stack traces, no provider bodies) | Done | `core/errors.py`, provider tests |
| Strict CORS | Done | `main.py`, `tests/test_api.py` |
| Startup config validation | Partial: URL, ranges and token strength validated; no check that the key works (see `tests/test_live_provider.py`) | `config.py` |
| Prompt-injection behaviour of the real model | Fixtures and harness ready; **not yet run against Nemotron** (needs a key) | `tests/test_injection.py` |
| Model-driven tool calling | Intentionally not built: the agent is a fixed pipeline with approval gates | `agent/workflows.py` |
| Encrypted database | Planned | — |

Redaction is pattern-based and will miss some secrets (about 5% of random 32-character tokens without enough digits, by measurement). Treat the consent dialog as the real control.

**Local token in practice.** The backend writes `.orbit-token` (repo root, git-ignored, owner-only where the OS supports it). Any program running as you can read it, so the token protects against other users, browser pages, and accidental exposure, not against malware under your account (out of scope, see `THREAT_MODEL.md`).
