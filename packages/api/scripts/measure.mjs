// Print real, reproducible numbers for the landing-page product mock.
//   node packages/api/scripts/measure.mjs
import pg from "pg";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let dir = dirname(fileURLToPath(import.meta.url));
for (let i = 0; i < 6; i++) {
  const c = resolve(dir, ".env");
  if (existsSync(c)) {
    dotenv.config({ path: c });
    break;
  }
  dir = resolve(dir, "..");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const events = (await client.query("SELECT count(*)::int AS n FROM events")).rows[0].n;
const embeds = (await client.query("SELECT count(*)::int AS n FROM event_embeddings")).rows[0].n;

const replay = (
  await client.query(
    "SELECT cost_usd, model FROM replays WHERE cost_usd IS NOT NULL AND cost_usd > 0 ORDER BY ended_at DESC NULLS LAST LIMIT 1"
  )
).rows[0];

// Use a real event embedding as the probe vector, then time the vector search.
const probe = (
  await client.query(
    `SELECT embedding FROM event_embeddings ee JOIN events e ON e.id = ee.event_id
     WHERE e.kind = 'tool_call' LIMIT 1`
  )
).rows[0];

let latencyMs = null;
let neighbours = [];
let explain = "";
if (probe) {
  const lit = String(probe.embedding);
  const sql = `SELECT e.kind, e.seq, ee.summary, ee.embedding <=> $1::VECTOR AS distance
       FROM event_embeddings ee JOIN events e ON e.id = ee.event_id
       ORDER BY ee.embedding <=> $1::VECTOR LIMIT 4`;
  // Warm up, then take the best of several runs (cold start dominates the first).
  for (let i = 0; i < 8; i++) {
    const t0 = performance.now();
    neighbours = (await client.query(sql, [lit])).rows;
    const ms = performance.now() - t0;
    latencyMs = latencyMs == null ? ms : Math.min(latencyMs, ms);
  }
  latencyMs = Math.round(latencyMs);
  const inlined = sql.replace(/\$1::VECTOR/g, `'${lit}'::VECTOR`);
  const ex = await client.query(`EXPLAIN ANALYZE ${inlined}`);
  explain = ex.rows.map((r) => Object.values(r)[0]).join("\n");
}

// Real replay cost from recorded token usage (Haiku 4.5: $1/$5 per 1M).
const usage = await client.query(
  `SELECT run_id,
          sum(coalesce((payload->'usage'->>'inputTokens')::int, 0))  AS in_tok,
          sum(coalesce((payload->'usage'->>'outputTokens')::int, 0)) AS out_tok
   FROM events WHERE kind = 'llm_call'
   GROUP BY run_id HAVING sum(coalesce((payload->'usage'->>'inputTokens')::int,0)) > 0
   ORDER BY 2 DESC LIMIT 1`
);
let realCost = null;
if (usage.rows[0]) {
  const { in_tok, out_tok } = usage.rows[0];
  realCost = (in_tok / 1e6) * 1.0 + (out_tok / 1e6) * 5.0;
  console.log("token usage row:", in_tok, "in /", out_tok, "out");
}

console.log("\n=== Rewind real measures ===");
console.log("events          :", events.toLocaleString());
console.log("event_embeddings:", embeds.toLocaleString());
console.log("replay cost_usd :", replay ? `$${Number(replay.cost_usd).toFixed(4)} (${replay.model})` : "none");
console.log("vector latency  :", latencyMs != null ? `${latencyMs} ms (warm best of 8)` : "n/a");
console.log("real replay cost:", realCost != null ? `$${realCost.toFixed(4)}` : "no usage recorded");
console.log("nearest neighbours:");
for (const n of neighbours) {
  console.log(`  ${n.kind} #${n.seq}  dist ${Number(n.distance).toFixed(3)}  ${n.summary?.slice(0, 60) ?? ""}`);
}
console.log("\n--- EXPLAIN ANALYZE ---\n" + explain + "\n");

await client.end();
