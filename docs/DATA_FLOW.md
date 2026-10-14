# Data flow: what goes where

| Data | Stored | Leaves the computer? |
|---|---|---|
| Chat messages | SQLite (`messages`) | Yes, to the hosted model when a provider is configured (never in demo mode) |
| Earlier turns of the current conversation (up to 6) | SQLite | Yes, with the next message, so follow-ups make sense |
| Memories | SQLite (`memories`) | Only confirmed ones that match the message, and only for skills that declare `memory.read` |
| Workspace file contents | Never stored (proposals store old/new content of the file being changed) | Only files you select, redacted, capped at 24,000 characters, **after you confirm** |
| Project layout (file names, folder names, dependency names) | Never stored | Only for project skills, **after you confirm** |
| Secrets found in files | Never stored | Never: redacted (or replaced by numbered placeholders for drafts and restored locally) |
| Proposed changes | SQLite (`proposed_changes`) | No |
| Audit log | SQLite (`audit_log`): action names, counts, paths, never contents | No |
| Camera frames | Browser memory only, for the current frame | No; not stored or uploaded |
| Nebius API key | `.env`, backend process memory | Only to Nebius in the `Authorization` header |
| Local API token | `.orbit-token`, backend and dev-proxy memory | No; never sent to the browser |

## A chat request
```
browser ──POST /api/chat/stream──▶ Vite proxy (+X-Orbit-Token) ──▶ FastAPI
  route skill → check permissions → read+redact files → [409 consent?] → memories → prompt with fences + history
  ──HTTPS──▶ Nebius Token Factory (Nemotron) ──SSE tokens──▶ FastAPI ──SSE──▶ browser (partial text)
  validate (repair once) → vet memory suggestion → store message + metadata → `done` event
```

## A project-agent run
```
goal ─▶ suggest files (local ranking) ─▶ user picks ─▶ read+redact (local) ─▶ [consent] ─▶ Nemotron (one call)
     ─▶ validated notes ─▶ Markdown rendered by code ─▶ proposed change (no write) ─▶ unconfirmed project memory
user approves ─▶ allow_write? ─▶ file unchanged? ─▶ race-safe write ─▶ hash verified ─▶ "applied and verified"
```
