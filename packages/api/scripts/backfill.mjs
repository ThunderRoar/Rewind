// Synthetic backfill: insert N events with random unit-vector embeddings (no
// Bedrock cost) to make the distributed vector index genuinely large.
//
// BULK-LOAD PATTERN: drop the vector index, load rows, then rebuild it ONCE.
// Maintaining a distributed vector index per-insert is ~100x slower than a
// single bulk build, and was the bottleneck in the naive version.
//
// Run from repo root (default 50k):
//   node --env-file=.env packages/api/scripts/backfill.mjs
// Millions (PowerShell): $env:BACKFILL_COUNT=2000000; node --env-file=.env packages/api/scripts/backfill.mjs
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";

const COUNT = Number(process.env.BACKFILL_COUNT ?? 50_000);
const BATCH = 2000; // ~9.5 MB embeddings INSERT - under CockroachDB's 16 MiB message limit
const DIM = 512;
const KINDS = ["llm_call", "tool_call", "tool_result", "memory_read", "memory_write", "observation"];

// Random unit vector, trimmed to 6 decimals (halves the SQL payload; fine for
// synthetic data). Returns an array of fixed-precision strings.
function unitVector(dim) {
  const v = new Array(dim);
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    const x = Math.random() * 2 - 1;
    v[i] = x;
    norm += x * x;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) v[i] = (v[i] / norm).toFixed(6);
  return v;
}

const sha = (obj) => createHash("sha256").update(JSON.stringify(obj)).digest("hex");

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("SET use_declarative_schema_changer = 'unsafe_always'");

  console.log("dropping vector index for fast bulk load...");
  await client.query("DROP INDEX IF EXISTS event_embeddings@event_embedding_idx");

  const agent = await client.query(
    `INSERT INTO agents (slug, owner) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`,
    [`synthetic-${Date.now()}`, "backfill"]
  );
  const runRes = await client.query(
    `INSERT INTO runs (agent_id, label, status, region)
     VALUES ($1, 'synthetic-backfill', 'complete', 'us-east-1') RETURNING id`,
    [agent.rows[0].id]
  );
  const runId = runRes.rows[0].id;

  let seq = 0;
  const t0 = Date.now();
  for (let done = 0; done < COUNT; done += BATCH) {
    const n = Math.min(BATCH, COUNT - done);
    const evVals = [];
    const evParams = [];
    const emVals = [];
    const emParams = [];
    for (let i = 0; i < n; i++) {
      const id = randomUUID();
      const kind = KINDS[(done + i) % KINDS.length];
      const payload = { synthetic: true, i: done + i };

      let p = evParams.length;
      evVals.push(`($${p + 1},$${p + 2},$${p + 3},$${p + 4},$${p + 5},$${p + 6})`);
      evParams.push(id, runId, seq++, kind, payload, sha(payload));

      let q = emParams.length;
      emVals.push(`($${q + 1},$${q + 2}::VECTOR,$${q + 3})`);
      emParams.push(id, `[${unitVector(DIM).join(",")}]`, `synthetic ${kind} #${done + i}`);
    }
    await client.query(
      `INSERT INTO events (id, run_id, seq, kind, payload, payload_sha) VALUES ${evVals.join(",")}`,
      evParams
    );
    await client.query(
      `INSERT INTO event_embeddings (event_id, embedding, summary) VALUES ${emVals.join(",")}`,
      emParams
    );
    console.log(`  loaded ${done + n}/${COUNT} (${Math.round((Date.now() - t0) / 1000)}s)`);
  }

  console.log("rebuilding vector index (one-time bulk build)...");
  const ti = Date.now();
  await client.query(
    "CREATE VECTOR INDEX event_embedding_idx ON event_embeddings (embedding vector_cosine_ops)"
  );
  console.log(`[SUCCESS] index rebuilt in ${Math.round((Date.now() - ti) / 1000)}s`);

  const total = await client.query("SELECT count(*)::int AS n FROM events");
  console.log(`[SUCCESS] backfill done. events total: ${total.rows[0].n}`);
} catch (err) {
  console.error("[FAILURE] backfill failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
