# ORBIT Project Guide

## What ORBIT is

ORBIT is a personal AI workspace for exploring software systems, asking questions about code, keeping useful notes, and organizing tasks. Its main feature is the **Visual Learning Studio**: enter the name of a system and explore its architecture as an interactive 3D scene.

The project has two main parts:

- **Frontend:** the website you use in your browser, built with React and TypeScript.
- **Backend:** a Python API that handles accounts, chat, data storage, workspace access, and model-provider requests.

The browser talks to the backend. The backend talks to the database and, when configured, to an AI provider. Provider API keys stay on the backend.

## Features

### 1. Visual Learning Studio

The Visual Learning page lets you explore system architecture one component at a time. ORBIT includes hand-built scenes for a three-tier web app, an e-commerce system, and an LLM platform. With a configured AI provider, you can also enter another topic, such as “Netflix” or “a stock exchange,” and ask ORBIT to propose a system design.

Each scene shows components and their connections. Selecting a component can show its purpose, APIs, data model, scaling approach, failure modes, and trade-offs. A guided flow helps explain how requests move through the system. AI-generated scenes are proposed teaching designs; they do not claim to show a company's private internal architecture.

You can use mouse controls without a camera. Optional hand tracking uses the browser camera and MediaPipe to recognize gestures for selecting or moving around the scene. Camera processing stays in the browser. The scene can be saved as a memory when you choose the Remember action.

### 2. AI Workspace and chat

Chat lets you ask questions, summarize text, explain code, plan tasks, and discuss system design. ORBIT selects a suitable built-in skill for the request. With a hosted provider configured, the backend sends the prompt to that provider and validates the response before returning it. Chat history is stored in the database for your account.

In demo mode, ORBIT returns clearly labeled placeholder answers. Demo mode is useful for exploring the interface without a model API key, but it does not provide real AI answers or generate new Visual Learning scenes.

### 3. Projects and local workspace tools

You can register a folder as a workspace so ORBIT can help browse its file tree, search files, preview text, or explain selected code. ORBIT does not automatically get access to arbitrary folders: you must authorize a workspace first, and file access is restricted by its path policy.

Workspaces can be read-only or allow writes. Before selected file excerpts are sent to a hosted AI provider, ORBIT redacts known secret patterns and asks for your consent. Proposed file changes require your approval, and the backend checks the workspace's write setting and the file's original hash before applying a change.

Projects can also hold notes and connect related memories. A project record and an authorized code workspace are related concepts, but authorizing a folder is what grants file access.

### 4. Memory

Memory is a list of facts, preferences, and learning notes you choose to keep. You can add, search, edit, and delete memories. ORBIT can retrieve relevant memories during a chat to give it useful context. It uses embeddings when available and can fall back to keyword matching.

Memory is scoped to the signed-in account. Visual Learning can save a selected component as a `VISION` memory and associate it with a project name.

### 5. Tasks and daily plans

You can create and update tasks yourself. ORBIT can also draft a daily schedule using task priorities, deadlines, fixed events, and a timezone. Generated task or schedule changes are shown as proposals that you can approve before they are saved.

### 6. Skills

Skills are reusable ways for ORBIT to handle different requests. The built-in set includes general question answering, summarization, code explanation, task planning, and system-design explanation. You can review and enable or disable available skills in the Skills page.

### 7. Accounts, settings, and privacy

Users register or sign in with an email and password. Passwords are stored as hashes, while the browser uses a short-lived signed bearer token for protected API calls. The backend applies account scoping, request validation, rate limits, and an allowed-origin policy.

Settings show model and backend information. Provider credentials are configured in the backend environment, not in browser code. If no stable JWT secret is configured, the backend creates a temporary one at startup, so signing in again may be needed after a restart.

### 8. VS Code extension and packaging

The repository includes VS Code extension source and a packaged VSIX. It is an optional editor integration; it has not been manually verified as installed in VS Code. Docker files are included for packaging the frontend, backend, and local PostgreSQL service. This repository does not provide a hosted deployment.

## How the project works

### Overall request path

1. You interact with a page in the React application.
2. The frontend sends an HTTP request, or a WebSocket request for streaming chat, to the FastAPI backend. Protected requests include your bearer token.
3. The backend verifies the account, validates the input, and applies permissions and rate limits.
4. The relevant service reads or updates account-scoped records in the database. A chat request may also use skills, relevant memories, or files from an authorized workspace.
5. If the task needs a hosted model, the backend calls the configured provider through its model gateway. The browser never calls the provider directly.
6. The backend returns the result to the frontend, which updates the page.

### What happens during a chat request

The chat endpoint checks authentication and input, then the agent orchestrator classifies the request and chooses an enabled skill. It checks whether the skill has the permissions it needs. For example, code questions using files require an authorized workspace.

The backend can retrieve relevant memories. If files are selected, it reads only the allowed paths, redacts recognized secrets, and limits how much text is included. When a hosted model would receive those excerpts, ORBIT asks for consent first. The model's response is parsed and validated, then the conversation and related metadata are saved.

When the selected provider is `demo`, the app uses local placeholder responses rather than making model API calls. Streaming chat uses a WebSocket; regular API features use HTTP.

### What happens when a new Visual Learning topic is entered

The frontend first checks whether the topic matches a built-in scene. If it does, it displays that scene locally. Otherwise, it sends the topic to the backend's scene-generation endpoint. The backend asks the configured model for structured JSON describing components, connections, and a system overview. It validates and repairs basic graph issues before returning the scene. Valid scenes are cached in memory to make repeat requests faster. Scene generation requires a configured hosted model and is unavailable in demo mode.

The browser turns the returned data into 3D objects using Three.js and React Three Fiber. Camera hand landmarks, when enabled, are processed locally in the browser; they are not sent to the backend. Only an explicit Remember action sends the selected learning note to the API.

### Data and database

SQLAlchemy maps application records such as users, conversations, messages, memories, tasks, projects, and workspaces to database tables. Alembic manages schema upgrades. PostgreSQL with pgvector is supported; SQLite is also suitable for local development and tests. Embedding-based memory search depends on the available model and database setup; keyword search is the fallback.

## Main screens

| Screen | What it is for |
| --- | --- |
| Home | Start a system exploration, review recent activity, and see items awaiting approval. |
| Visual Learning | Explore built-in or generated system designs in 3D. |
| AI Workspace | Chat with ORBIT and work through reusable skills. |
| Projects | Manage projects and authorized local workspaces, and work with files and notes. |
| Memory | Review, search, edit, or remove saved information. |
| Skills | View and manage the available assistant skills. |
| Tasks and Plans | Manage tasks and review daily schedules or proposals. |
| Settings and Privacy | See backend/provider status and configuration guidance. |

## Main folders in the repository

- `frontend/` — React pages, API client, styles, 3D scene, and hand-tracking code.
- `backend/app/api/` — FastAPI routes for chat, accounts, projects, memory, tasks, schedules, and Visual Learning.
- `backend/app/agent/` — request routing, skill selection, context preparation, and chat orchestration.
- `backend/app/skills/` — built-in skill definitions and registry.
- `backend/app/providers/` and `backend/app/services/` — AI provider adapters, model gateway, and scene generation.
- `backend/app/workspace/` — workspace path rules, file operations, and code explanation helpers.
- `backend/app/memory/` — memory storage and retrieval.
- `backend/migrations/` — Alembic database schema revisions.
- `backend/tests/` and `frontend/tests/` — automated tests.
- `vscode-extension/` — VS Code extension source and package.
- `examples/` — example project and skill content.
- `docs/` — additional project documentation.

## Running locally

The complete setup guide is in `README.md`. In short, the frontend needs Node.js and npm; the backend needs Python 3.11 or newer. For a quick local run without Docker or provider credentials, copy `.env.example` to `.env` and set:

```dotenv
LLM_PROVIDER=demo
ORBIT_DEMO_MODE=true
ORBIT_DATABASE_URL=sqlite:///./orbit-dev.db
```

The database URL is important. If it points to PostgreSQL, a PostgreSQL server must be running and the username/password in the URL must match that server. A PostgreSQL message saying `password authentication failed for user "orbit"` means the server was reached but rejected the configured password. It is not fixed by resetting a SQLite database.

## Current limitations to keep in mind

- Demo mode uses placeholder answers; real chat and new model-generated scenes need a configured provider and valid credentials.
- Generated architectures are model-proposed explanations and may need fact-checking.
- Camera permissions, browser/device performance, and hand gestures depend on the browser and hardware.
- The README records which features were tested locally and which still need live provider, browser, or deployment verification.
- The project is a local development application; no live hosted deployment is included.

## Suggested first-time exploration

1. Run ORBIT in demo mode with SQLite.
2. Create an account and open Visual Learning to explore one of the built-in scenes.
3. Select a component and save it to Memory.
4. Try the AI Workspace and inspect the demo label so you know responses are placeholders.
5. If you want file explanations, authorize the included `examples/example-project` folder in Projects.
6. Configure a supported model provider only when you want real model responses or generated scenes.
