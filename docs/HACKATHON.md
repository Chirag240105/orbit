# Hackathon rules and how ORBIT meets them (SH-03)

**Source caveat:** the official Devpost rules page (https://nebiusglobalaihackathon.devpost.com/rules) could only be read in part when this note was written (2026-10-15). Points marked † come from secondary sources (other teams' repositories and an event recap). **Before submitting, check every line against the full Devpost text.**

## Key facts
- **Deadline:** 30 October 2026, 10:00 AM PT (submission period opened 26 August 2026). †
- **Eligibility (all tracks):** a working app that (1) runs on Nebius Token Factory or Nebius AI Cloud, (2) uses at least one NVIDIA open-source model, (3) fits a track. "Runs on Nebius" = a runtime call to the Token Factory inference API, **or** deployment on Nebius AI Cloud (Serverless Jobs, Serverless Endpoints, DevPods). †
- **Personal AI track:** an always-on, private assistant that works for you and keeps your data under your control: persistent memory, reusable skills, selected tool and information access, daily-workflow execution. NemoClaw, OpenShell, Hermes Agent and Nebius Serverless are named as examples, not requirements. †
- **Submission:** public repository with source, assets, setup and run instructions; a visible open-source license (Apache-2.0, MIT or MPL-2.0 given as examples); a README that highlights how NVIDIA open models (Nemotron) and Token Factory / other Nebius services were used; a demo video under 3 minutes showing the real product working. †
- **Judging:** technological implementation (including how well Token Factory/AI Cloud and Nemotron are used), design (a complete, coherent product, not a proof of concept), potential impact. One source says four equally weighted criteria; verify. †

## ORBIT against the requirements

| Requirement | ORBIT today | Gap |
|---|---|---|
| Runs on Nebius (Token Factory call at runtime) | `providers/nebius.py` calls `/chat/completions` (normal and streaming) | **Never called live. AI-01 needs a key.** Record evidence (model ID, a request ID or console screenshot) |
| NVIDIA open-source model | Nemotron via Token Factory, model ID configurable | Default ID unverified: run `scripts/list_models.py` |
| Always-on | Local web app, started with `python scripts/dev.py` | Not a background/desktop process (`DEPLOYMENT.md`). Say so honestly |
| Private, user-controlled | Folder allowlist, read-only default, approval + verified writes, consent before any workspace data leaves, redaction, local API token, delete-all | Hosted inference means prompts leave the machine; the README says so |
| Persistent memory | User-confirmed memories, project memories from the agent, conversation history in context | Keyword retrieval, not semantic |
| Reusable skills | 6 chat skills + 3 workflow skills, registry with declared permissions, example third-party skill | — |
| Selected tool/information access | Permissioned file tools; per-workspace write switch | No editor or app integrations |
| Daily-workflow execution | Project agent (read → analyze → draft → propose → remember), AI drafts, plans → tasks | Fixed pipeline, not an open-ended planner (deliberate, see `ARCHITECTURE.md`) |
| License | MIT (`LICENSE`) | — |
| README highlights Nemotron and Token Factory | Status table and privacy section | Add the verified model ID and evidence after AI-01 (`SUBMISSION.md`) |
| Demo video < 3 min, real model output | Script in `DEMO_SCRIPT.md` | Needs AI-01, then recording (DEMO-02) |
