# Demo script (DEMO-01): 3 minutes

**Status: draft. Needs AI-01 (a live Nebius key) and two rehearsals.** Use a real model for the recording; keep demo mode only as the network fallback, and say so on screen if you use it.

## Before you start
- `python scripts/dev.py` with `NEBIUS_API_KEY` set; browser at `http://localhost:5173`, 1280×800, zoom 100%.
- Delete history and memories in Settings. Authorize a **copy** of `examples/example-project` (the agent writes into it). Add one memory: "I prefer short explanations with examples".
- Print markers #1 and #2 (`/visual/markers`) and keep them out of camera view.
- Fallback: if the network fails, restart with `--demo`. Every screen labels demo output.

## Script
| Time | Show | Say |
|---|---|---|
| 0:00–0:15 | Home | "ORBIT is a personal AI agent that only sees folders I authorize, only remembers what I approve, and never changes a file without my approval. It runs NVIDIA Nemotron on Nebius Token Factory." |
| 0:15–0:45 | Chat: "Explain Kubernetes like I'm a beginner, then give me a diagram, real-world example, and interview questions." | Point at the streaming text, then the validated result: diagram, example, interview questions, and the model badge. "Every answer is checked against a schema." |
| 0:45–1:35 | Projects → Project agent: goal "Explain how this project greets people and write notes for a new teammate" → Suggest files → pick `app.py` → Run | Consent dialog: "Before anything leaves my laptop, ORBIT shows exactly what: one file, the layout, and one secret it redacted." Steps appear. Proposed change with diff. Approve → refused (writes off). Allow writes → approve → "applied and verified". Confirm the project memory |
| 1:35–1:55 | Chat: "What does the greet function return?" in a new conversation | If the question shares words with the confirmed project memory, the answer shows a "memory used" badge (check the wording in rehearsal). "It remembers across sessions, but only what I confirmed." |
| 1:55–2:35 | Visual Learning: select Load balancer → "Explain more with AI" → start camera → detection on → show marker #2 | "AI-generated" label; the scene switches to the serverless app. "Recognition runs in the browser; video never leaves it." Stop camera |
| 2:35–2:55 | Settings | "What leaves your computer", tool permissions, delete-all. "Private by design, honest about the hosted model." |
| 2:55–3:00 | — | "ORBIT: one agent, your rules." |

## Rehearsal log
| Date | Who | Time | Problems |
|---|---|---|---|
| | | | |
