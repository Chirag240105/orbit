# Submission write-up (DEMO-03): draft

**Status: draft. Fill the bracketed items after AI-01, and cross-check every claim with the README status table and `HACKATHON.md` before submitting.**

## ORBIT: your personal AI operating layer
A permission-controlled personal AI agent for developers and students. It understands your requests, learns from the folders you authorize, remembers what you approve across sessions, and helps you act on your projects, stopping for your approval before anything is written.

## How we use NVIDIA and Nebius
- **Model:** NVIDIA Nemotron, model ID `[verified ID from scripts/list_models.py]`, through **Nebius Token Factory**'s OpenAI-compatible API (`backend/app/providers/nebius.py`), with normal and streaming completions.
- Nemotron powers every skill: answers, lessons with diagrams, project overviews, the project agent's notes, AI-drafted file changes, explanations in the 3D studio, and (optionally) skill routing.
- Reasoning output is handled explicitly: `<think>` content is never shown or streamed, and the token budget is configurable.
- **Evidence:** `[request ID / Token Factory usage screenshot / date]`. Live reliability: `[x]%` of 20 test prompts validated without fallback (`docs/AI_AGENT_DESIGN.md`).

## What runs where
| Local (your computer) | Nebius (hosted) |
|---|---|
| UI, API, database, memory retrieval, file indexing and search, file ranking, permission checks, secret redaction, diffs, writes and their verification, marker recognition from the camera | Nemotron inference only, on the text you send: messages, matching confirmed memories, recent turns, and (after you confirm) selected file excerpts or the project layout |

## Built and tested
[Copy the README "Feature status" table at submission time.]

## Not implemented / limitations
- Local web app, not an always-on desktop app (Tauri is a stretch goal).
- Recognizes ORBIT's own printed markers, not arbitrary objects. No gesture control.
- The agent is a fixed pipeline with approval gates, not an open-ended planner.
- Keyword memory retrieval (stemmed), not semantic.
- Secret redaction is best effort; the consent dialog is the real control.
- Single user, local only.

## Team
Chirag: agent, backend, integrations, security. Charanjeet: frontend, UX, visual learning, integration.
