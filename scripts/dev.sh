#!/usr/bin/env bash
# Start backend (8000) and frontend (5173). Run from the repo root. Ctrl+C stops both.
set -euo pipefail
(cd backend && uvicorn app.main:app_factory --factory --host 127.0.0.1 --port 8000 --reload) &
BACK=$!
trap 'kill $BACK 2>/dev/null' EXIT
(cd frontend && npm run dev)
