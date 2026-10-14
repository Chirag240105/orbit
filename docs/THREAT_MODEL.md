# Threat model

| Boundary | Trust | Main threats | Mitigations (status) |
|---|---|---|---|
| Frontend ↔ backend | Local, single user | Other sites calling the API; unauthenticated local processes | CORS allowlist, no wildcard, no credentials (**implemented**); binds `127.0.0.1` (**documented default**); local session token (**planned, SEC-01**) |
| Backend ↔ model provider | Hosted, untrusted | Data exposure; key leak; hostile output | Key only in backend env; HTTPS-only URL validation; consent before file text is sent; redaction; output validated against schema; provider errors made generic (**implemented, tested with mocks**). Live provider call **not yet verified (AI-01)** |
| Model output | Untrusted | Prompt injection causing actions; malicious commands in text | No shell/subprocess anywhere; model cannot call tools in MVP; output is only rendered as text/JSON (**implemented**) |
| Retrieved files / memories | Untrusted data | Injected instructions ("ignore previous rules…") | Fenced in `<untrusted_data>`, closing tag neutralized, system preamble says data ≠ instructions (**implemented; effectiveness against a real model untested, SEC-05**) |
| Workspace files | User-authorized only | Path traversal, symlink escape, secret exposure, unwanted writes | Absolute-path/`..` rejection, `realpath` containment, exclusion list, extension allowlist, size limit, read-only default, approval + `allow_write` + stale-hash check (**implemented, unit and API tested**). TOCTOU between check and write is **not fully closed (SEC-04)** |
| Memory store | Local DB | Poisoned or unwanted memories; leakage via prompts | Only user-confirmed memories are used; suggestions start unconfirmed; delete one/all (**implemented**) |
| Tool execution | Backend only | Privilege escalation via a new tool/skill | Registered ≠ permitted: permissions are checked per call; writes need confirmation (**implemented**) |
| Camera | Browser-controlled | Silent capture; upload | Starts only on click; visible indicator; stop button; no recording or upload code exists (**implemented; not tested in a real browser**) |
| Logs / audit | Local | Secrets in logs | Audit stores metadata only; unhandled errors log the exception type only (**implemented**) |

## Out of scope for the MVP
Multi-user auth, remote deployment hardening, encrypted-at-rest database, malware in authorized folders, a compromised local machine.
