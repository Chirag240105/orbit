# Database schema

SQLite by default (`ORBIT_DATABASE_URL`), managed by Alembic (`backend/migrations/versions`). The app runs `upgrade head` on start; a database created by ORBIT 0.1 (no `alembic_version`) is stamped at `0001` first. `tests/test_migrations.py` checks that a migrated database matches the models exactly.

| Table | Columns (type) | Notes |
|---|---|---|
| `memories` | id, content (text), type (`fact`/`preference`/`project`/`other`), source (`user`/`chat_suggestion`/`agent`), confirmed (bool), created_at, updated_at | Only `confirmed` rows are ever retrieved |
| `conversations` | id, title (≤120), created_at, updated_at | `updated_at` moves on each message |
| `messages` | id, conversation_id → conversations (cascade), role (`user`/`assistant`), content (user text, or assistant output as JSON), skill, meta (JSON: provider, context, warnings, change_id), created_at | `meta` never contains file contents |
| `workspaces` | id, name, path (unique, real path), allow_write (bool), created_at | |
| `proposed_changes` | id, workspace_id → workspaces (cascade), rel_path, description (≤300), original_content (null = new file), base_hash (sha256), new_content, status (`pending`/`applied`/`rejected`/`stale`), **origin (`user`/`ai`, rev 0002)**, created_at, decided_at | |
| `tasks` | id, title, notes, status (`proposed`/`todo`/`doing`/`done`), priority (`high`/`medium`/`low`), due (date), source (`user`/`plan`), created_at | |
| `skill_settings` | name (PK), enabled | Missing row = enabled |
| `audit_log` | id, ts, action, detail (JSON, strings capped at 200 chars) | Metadata only |

## Revisions
| Revision | Change |
|---|---|
| 0001 | Initial schema (identical to what 0.1 created with `create_all`) |
| 0002 | `proposed_changes.origin` |

New revision: change `app/models.py`, then `cd backend && alembic revision --autogenerate -m "what changed"`, review the file (SQLite uses batch mode), and run the tests.
