# db
SQLAlchemy engine and sessions. `init_db` runs Alembic migrations (`backend/migrations`) and stamps databases created by ORBIT 0.1. `new_session()` is for work that outlives a request (streaming). Schema: `docs/DATABASE_SCHEMA.md`.
