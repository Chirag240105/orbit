import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.db.session import _state, init_db
from app.memory.service import gate_and_suggest, retrieve_relevant
from app.models import Memory, User


class FakeGateway:
    provider = "nebius"
    settings = SimpleNamespace(mock_ai=False, demo_mode=False)

    async def embed(self, _texts):
        return [[1.0, 0.0]]


def scoped_session():
    init_db("sqlite://", create_tables=True)
    db = _state["maker"]()
    user = User(email="memory@example.com", password_hash="test")
    db.add(user)
    db.commit()
    db.info["user_id"] = user.id
    return db


def test_retrieval_ranks_by_cosine_importance_and_recency_and_touches_access():
    db = scoped_session()
    now = datetime.now(timezone.utc)
    stale = Memory(content="exact old match", type="USER", source="user", confirmed=True,
                   importance=1.0, embedding=[1.0, 0.0], last_accessed=now - timedelta(days=120))
    durable = Memory(content="relevant durable preference", type="PREFERENCE", source="user", confirmed=True,
                     importance=1.0, embedding=[0.8, 0.6], last_accessed=now)
    db.add_all([stale, durable])
    db.commit()

    rows = asyncio.run(retrieve_relevant(db, "match", FakeGateway()))
    assert rows[0].id == durable.id
    assert rows[0].last_accessed.replace(tzinfo=timezone.utc) >= now
    db.close()


def test_importance_gate_rejects_small_talk_without_a_model_call():
    db = scoped_session()

    class NeverCalled(FakeGateway):
        async def complete(self, *_args, **_kwargs):
            raise AssertionError("small talk should be rejected before calling the gate model")

    saved = asyncio.run(gate_and_suggest(db, candidate="The user likes tea", user_text="Thanks!", gateway=NeverCalled()))
    assert saved is None
    assert db.query(Memory).count() == 0
    db.close()


def test_importance_gate_stores_durable_user_fact_as_unconfirmed():
    db = scoped_session()

    class StoringGateway(FakeGateway):
        async def complete(self, _messages, task="planner"):
            assert task == "fast"
            return SimpleNamespace(text='{"store":true,"type":"PREFERENCE","content":"I prefer PostgreSQL","importance":0.8}')

    memory = asyncio.run(gate_and_suggest(
        db, candidate="The user prefers PostgreSQL", user_text="I prefer PostgreSQL for work projects.", gateway=StoringGateway()
    ))
    assert memory is not None
    assert memory.type == "PREFERENCE" and memory.importance == 0.8
    assert memory.confirmed is False and memory.embedding == [1.0, 0.0]
    db.close()
