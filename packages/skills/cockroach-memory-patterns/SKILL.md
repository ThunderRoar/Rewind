---
name: cockroach-memory-patterns
description: Use when designing or writing an AI agent's memory layer on CockroachDB — idempotent writes, content-addressed dedup, region-aware reads, and vector search. Apply when choosing how to store agent memories/events durably and search them semantically.
---

# CockroachDB agent-memory patterns

CockroachDB is a strong agent-memory substrate: distributed, strongly consistent, and it has a native `VECTOR` type with a distributed index. These patterns keep memory correct and fast at scale.

## Append-only, never mutate

Store agent history as append-only events. Never `UPDATE`/`DELETE` a past event — a "correction" is a *new* row. This is what makes time-travel and forking possible: a fork is new rows referencing a parent, not a mutation.

## Content-address for dedup

Compute a `payload_sha` (sha256 of canonical, key-sorted JSON) for each event. Identical payloads share a hash, so a fork can reuse unchanged rows and a diff can tell "same event" from "genuinely new" by hash, not guesswork.

## Idempotent memory upserts

Agents retry. Make memory writes idempotent with a natural key:
```sql
INSERT INTO memories (agent_id, run_id, key, value)
VALUES ($1, $2, $3, $4)
ON CONFLICT (agent_id, run_id, key) DO UPDATE SET value = EXCLUDED.value;
```

## Vectors: embed, index, search

- Column: `embedding VECTOR(512)` (match your embedding model's dimension exactly).
- Index: `CREATE VECTOR INDEX ... (embedding vector_cosine_ops)`.
- Search with the cosine operator so the index is used:
  ```sql
  SELECT id, summary FROM event_embeddings
  ORDER BY embedding <=> $1::VECTOR LIMIT 10;
  ```
- Bulk-load pattern: **drop the vector index, insert rows, rebuild the index once.** Per-insert index maintenance is ~100× slower.

## Gotchas (CockroachDB Cloud Basic)

- `SET CLUSTER SETTING` is disallowed; use session settings.
- Vector index builds need the declarative schema changer: `SET use_declarative_schema_changer = 'unsafe_always'`, applied via a pgwire client (not the Cloud SQL console).
- Multi-row `INSERT` of vectors caps near ~2000 rows/statement (16 MiB message limit).
