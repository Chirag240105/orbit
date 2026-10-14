# workspace
`policy.py` is the only code that turns a user- or model-supplied path into a real path (`resolve_inside`), plus the exclusion list, extension allowlist and size limits. `service.py`: listing, search, local file ranking, summary with dependencies, and race-safe verified writes. Change policy only with tests. Rules: `docs/WORKSPACE_ACCESS.md`.
