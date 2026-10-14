# Memory design

**What is remembered:** facts and preferences you add, suggestions you save from chat (unconfirmed until confirmed), project facts the project agent suggests (unconfirmed, prefixed with the workspace name, never duplicated), and the conversation itself (the last 6 messages go with each follow-up).

**What is used:** only confirmed memories, only for skills that declare `memory.read`, at most 5 per request, chosen by retrieval below. Each answer shows how many memories it used.

**Control:** edit, delete one, delete all, filter by type/source/status, bulk-confirm suggestions. Memories are plain rows in SQLite (`DATABASE_SCHEMA.md`).

## Retrieval evaluation (AI-06)
Labeled set: 15 memories, 20 queries with known relevant memories (`backend/tests/test_memory_eval.py`), including word-form variants ("interviews" ↔ "interview", "deploying" ↔ "deploy") and multi-relevant queries.

| Method | Recall@3 | MRR |
|---|---|---|
| Keyword overlap (baseline) | 0.80 | 0.775 |
| **Keyword overlap with light stemming (adopted)** | **0.95** | **0.925** |
| BM25 with stemming | 0.95 | 0.925 |

The whole gain comes from stemming. BM25 ties on this set, so the simpler method was adopted, following the rule "only adopt a change that beats the baseline". The test fails if the default ever falls below the best method. Embeddings were not tried: no failure in the set needs synonyms. The one query that still misses ("Explain load balancers" → "I like explanations with diagrams") would need semantic matching.

**Caveat:** the set is small and was written by the same person who wrote the scorer. Extend it with real queries from usage before drawing strong conclusions.
