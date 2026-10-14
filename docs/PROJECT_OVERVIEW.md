# Project overview

ORBIT is a permission-controlled personal AI agent for developers and students. It understands requests, learns from folders you authorize, remembers what you approve across sessions, and helps you act, always stopping for your approval before anything changes on disk.

## Who it is for
Developers and students who want help with their own projects and learning, without handing an assistant their whole disk or a free hand to edit files.

## What it does
| Capability | What the user sees | Where |
|---|---|---|
| Chat and skills | Ask, learn a topic (explanation, text diagram, real-world example, interview questions), summarize, plan (→ tasks), explain a file, understand a project. Answers stream in and are validated against a schema | `features/chat`, `agent/orchestrator.py`, `skills/` |
| Project agent | Give a goal; ORBIT suggests relevant files, reads the ones you pick, writes Markdown notes, proposes the file, and suggests a project memory. You approve the write | `features/projects/AgentPanel.tsx`, `agent/workflows.py` |
| Safe file changes | Edit manually or ask ORBIT to draft a change; see a line diff; approve or reject; writes are verified | `features/projects`, `tools/registry.py`, `workspace/` |
| Memory | Add, edit, search, filter, bulk-confirm suggestions, delete all. Only confirmed memories are used | `features/memory`, `memory/service.py` |
| Visual Learning Studio | Two curated 3D scenes, step-by-step learning, AI explanations, printed markers recognized by the camera | `features/visual-learning` |
| Privacy controls | Settings shows what leaves the machine, tool permissions, camera state; consent dialogs before workspace data goes to the hosted model | `features/settings`, `components/ConsentDialog.tsx` |

## How it is built
React + TypeScript + Vite frontend, FastAPI + SQLAlchemy + Alembic + SQLite backend, NVIDIA Nemotron on Nebius Token Factory (OpenAI-compatible API). Details: `ARCHITECTURE.md`, `DATA_FLOW.md`, `AI_AGENT_DESIGN.md`.

## What is honest to claim
See the status table in the README. In short: everything runs and is tested in demo mode and against a scripted fake model; the live Nemotron call has not been made yet (it needs an API key); marker recognition is printed markers, not object recognition; the app is a local web app, not a desktop app.
