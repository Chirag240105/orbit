# Repo Design — Manual Verification Notes

**Date:** 2026-10-30  
**Status:** NOT YET RUN — requires a live NVIDIA_API_KEY and network access.

This file is the honest record of manual runs. Nothing is claimed until it is actually run.

---

## What to run

From the repository root, with the backend running and NVIDIA_API_KEY set:

### Local workspace (ORBIT repo itself)

1. Authorize `c:\Users\chirag pandey\Documents\orbit` (or your clone path) in the Projects screen.
2. Click **✦ Visualize design** on the authorized workspace.
3. The backend will run the pipeline: Read files → Summarize modules (MODEL_FAST, parallel) → Build scene (MODEL_PLANNER).
4. The Visual Learning Studio opens with the generated scene.

Expected: 8–12 components representing the frontend, backend services, database, providers, skills, workspace, agent, and API layers. Connections should reflect the actual import graph.

### GitHub repo (small: fastapi/fastapi)

1. On the Visual Learning Studio page, click **Import from GitHub repo**.
2. Enter: `https://github.com/tiangolo/fastapi`
3. Click **✦ Visualize**.

Expected: A scene with components for the FastAPI core, routing, dependencies, middleware, and test suite — labeled "Derived from the repository code."

### GitHub repo (large: ollama/ollama)

1. Enter: `https://github.com/ollama/ollama`
2. Click **✦ Visualize**.

Expected: A top-level architecture view (8–12 components) grouping the Go packages (server, api, model, runner, llm). The scene is a high-level map, not a line-by-line representation. Model loading, API server, and GPU runner should be visible. The description should read "Derived from the repository code (model-assisted, may contain mistakes)."

---

## Results (fill in after running)

| Scenario | Run? | Result | Notes |
|---|---|---|---|
| ORBIT local workspace | NOT RUN | — | Requires live key |
| fastapi/fastapi GitHub | NOT RUN | — | Requires live key + network |
| ollama/ollama GitHub | NOT RUN | — | Requires live key + network + ~15 s |

---

## Known limitations

- The pipeline reads up to 5,000 files and 25 MB of zip. Very large monorepos will be truncated.
- The map step runs up to 12 module groups in parallel with MODEL_FAST. Each group sends ≤ 3,000 chars of file content.
- The reduce step sends ≤ 40,000 chars total to MODEL_PLANNER. Large repos produce a high-level view, not a detailed component map.
- The scene is labeled "model-assisted, may contain mistakes." Components and edges are grounded (hallucinated IDs are dropped) but the descriptions are model-generated.
- Private repos are not supported. The GitHub token (GITHUB_TOKEN env) is used only to raise rate limits, not for authentication.
