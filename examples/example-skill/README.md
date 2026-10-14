# Example skill: Standup notes

1. Copy `standup_notes.py` to `backend/app/skills/`.
2. In `backend/app/skills/registry.py`, import it and add `StandupNotes()` to the tuple in `default_registry()`.
3. Restart the backend. The skill appears in **Skills** and in the chat skill picker.
4. Test: from `backend/`, run `pytest ../examples/example-skill -q`.

The skill declares `required_permissions = ()`, so it can't read memory or files. If you add `"workspace.read"`, the orchestrator still refuses it unless the request has an authorized workspace selected.
