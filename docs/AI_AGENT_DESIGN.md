# AI agent design

## Principles
1. **The model proposes, code decides, the user approves.** No model output is ever executed. The agent is a fixed sequence of steps in code; the model fills in analysis and drafts.
2. **Every output is validated** against a Pydantic schema; a mismatch is repaired once, then shown as plain text with a warning.
3. **Least context:** a skill only receives what it declares (`memory.read`, `workspace.read`), and workspace data only leaves after consent.
4. **Honest labels:** demo output, curated text, AI-generated text, and unvalidated streaming text are all labeled in the UI.

## Skills
| Skill | Kind | Permissions | Output |
|---|---|---|---|
| `general_qa` | chat (default) | memory | answer, key points, follow-ups, suggested memory (vetted) |
| `explain_code` | chat (needs a file) | workspace, memory | overview, key points, risks |
| `project_overview` | chat | workspace (+ layout), memory | overview, components, data flow, dependencies, risks, next steps |
| `learn_topic` | chat | memory | explanation, text diagram, real-world example, key points, interview questions |
| `summarize_text` | chat | memory | summary, key points |
| `task_plan` | chat | memory | summary, tasks (proposed, never saved automatically) |
| `project_notes` | workflow | workspace, propose, memory | title, summary, sections, key files, open questions, memory |
| `draft_change` | workflow | workspace, propose | summary + full new file (tag format, not JSON, so code survives) |
| `explain_component` | workflow | none | explanation, analogy, failure impact |

## Routing (AI-03)
Explicit choice → model routing (`ORBIT_MODEL_ROUTING=true`: the model picks from enabled chat skills the request may use; unknown, disabled or workflow names are ignored; any error falls back) → keyword patterns in registration order → `general_qa`. The chosen route is stored in `context.routing` and shown on hover in chat.

## Reliability (AI-02)
- One repair round: the model gets its own reply back with the reason ("these fields were missing or invalid: answer") and must answer in the required format. `ORBIT_REPAIR_RETRIES` (0–2).
- Nemotron reasoning: `<think>` blocks are removed, and an empty answer is a clear `provider_empty_response` error. `NEBIUS_MAX_TOKENS` raises the budget.
- **Measured reliability: not yet.** `ORBIT_LIVE_TESTS=1 pytest tests/test_live_provider.py -s` runs 20 prompts across four skills and prints the rate (target ≥ 90% valid without fallback). Record it here:

| Date | Model | Valid without fallback | Repaired | Fallback |
|---|---|---|---|---|
| | | | | |

## Memory suggestions (AI-07)
The prompt asks only for lasting facts the user stated about themselves. Independently, `vet_suggestion` keeps a suggestion only if it is short, contains no secret, matches no sensitive category (health, finances, credentials, beliefs, politics, sexuality, legal), and at least half its words come from the user's own message. 20 fixtures (10 keep, 10 drop) pass. Suggestions are never stored until the user clicks Save, and saved suggestions stay unconfirmed until confirmed.

## Streaming (AI-04)
`POST /api/chat/stream` uses the provider's SSE stream. Text inside `<think>` is never forwarded, and a partial `<think` tag is held back so nothing has to be retracted. The frontend shows the growing main field (not raw JSON) labeled "not yet validated", then swaps in the validated result. Stop aborts the request.

## Why not an open-ended tool loop yet
A loop where the model picks tools makes every retrieved file a potential instruction channel. The fixed pipeline gets the same user-visible behaviour (decide → act → verify → remember) with approval gates, and is testable. Revisit after the live injection results (SEC-05) and after confirming Nemotron tool calling on Token Factory.
