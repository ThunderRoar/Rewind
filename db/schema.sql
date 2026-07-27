-- Rewind - CockroachDB schema
--
-- Apply through a real pgwire client (packages/api/scripts/apply-schema.mjs),
-- NOT the Cloud SQL console
--
-- Embedding dimension is 512 (Titan v2 @ dimensions:512). If you change it,
-- update every VECTOR(512) below AND the vector indexes to match.

SET use_declarative_schema_changer = 'unsafe_always';

-- Core entities -------------------------------------------------

CREATE TABLE IF NOT EXISTS agents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         STRING UNIQUE NOT NULL,
  owner        STRING NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL REFERENCES agents(id),
  parent_run   UUID REFERENCES runs(id),         -- null = root, set = fork
  forked_from  UUID,                             -- FK added after events (circular ref)
  label        STRING,
  status       STRING NOT NULL,                  -- 'live' | 'complete' | 'replaying'
  region       STRING NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Timeline (append-only) ----------------------------------------

CREATE TABLE IF NOT EXISTS events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID NOT NULL REFERENCES runs(id),
  seq          INT NOT NULL,                     -- monotonic per run_id
  parent_event UUID REFERENCES events(id),
  kind         STRING NOT NULL,                  -- llm_call | tool_call | tool_result |
                                                 -- memory_read | memory_write | observation | ccloud_action
  payload      JSONB NOT NULL,
  payload_sha  STRING NOT NULL,                  -- content-address; forks reuse rows
  s3_overflow  STRING,                           -- s3://... if payload > 64KB
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  INDEX (run_id, seq) USING HASH,                -- hash-sharded (not Postgres PARTITION BY HASH)
  INDEX (kind, ts)
);

ALTER TABLE runs
  ADD CONSTRAINT runs_forked_from_fk
  FOREIGN KEY (forked_from) REFERENCES events(id);

CREATE TABLE IF NOT EXISTS event_embeddings (
  event_id     UUID PRIMARY KEY REFERENCES events(id),
  embedding    VECTOR(512) NOT NULL,
  summary      STRING NOT NULL
);
CREATE VECTOR INDEX IF NOT EXISTS event_embedding_idx
  ON event_embeddings (embedding vector_cosine_ops);

-- Memories = what the agent sees (vs events = what happened) -----

CREATE TABLE IF NOT EXISTS memories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL REFERENCES agents(id),
  run_id       UUID REFERENCES runs(id),         -- null = shared across runs
  key          STRING NOT NULL,
  value        JSONB NOT NULL,
  embedding    VECTOR(512),
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, run_id, key)
);
CREATE VECTOR INDEX IF NOT EXISTS memory_embedding_idx
  ON memories (embedding vector_cosine_ops);

-- Forks & replays -----------------------------------------------

CREATE TABLE IF NOT EXISTS forks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_run    UUID NOT NULL REFERENCES runs(id),
  new_run         UUID NOT NULL REFERENCES runs(id),
  forked_at_event UUID NOT NULL REFERENCES events(id),
  edits           JSONB NOT NULL,
  reason          STRING,
  created_by      STRING NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS replays (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fork_id      UUID NOT NULL REFERENCES forks(id),
  model        STRING NOT NULL,                  -- Bedrock inference-profile id
  kind         STRING NOT NULL,                  -- 'control' | 'edited'
  temperature  DECIMAL(3,2) NOT NULL DEFAULT 0,
  seed         INT,                              -- Bedrock seed where supported (Claude has none)
  status       STRING NOT NULL,                  -- queued | running | done | failed
  cost_usd     DECIMAL(10, 6),
  latency_ms   INT,
  started_at   TIMESTAMPTZ,
  ended_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner        STRING NOT NULL,
  action       STRING NOT NULL,                  -- fork | replay | edit_memory | search
  target       STRING NOT NULL,
  detail       JSONB,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  INDEX (owner, ts)
);
