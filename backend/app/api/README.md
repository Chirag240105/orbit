# api
HTTP routes (`routes.py`, kept thin) and dependencies (`deps.py`: the local API token check, workspace lookup, tool context). Every route declares a response model; `/api/health` is the only route without the token. Reference: `docs/API_REFERENCE.md`.
