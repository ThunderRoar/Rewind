// Clean up demo data. Modes:
//   node scripts/reset-db.mjs synthetic   # remove the owner='backfill' vectors (declutter)
//   node scripts/reset-db.mjs seed        # remove the seed-tenants data (undo seed-tenants)
//   node scripts/reset-db.mjs all --yes   # TRUNCATE everything (schema stays; re-seed from scratch)
// The 'all' mode also deletes the real refund runs and their Titan embeddings,
// which are slow/costly to regenerate — prefer 'synthetic' / 'seed' for cleanup.
import pg from "pg";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let dir = dirname(fileURLToPath(import.meta.url));
for (let i = 0; i < 6; i++) {
  const c = resolve(dir, ".env");
  if (existsSync(c)) { dotenv.config({ path: c }); break; }
  dir = resolve(dir, "..");
}

const mode = process.argv[2];
const yes = process.argv.includes("--yes");
const SEED_SLUGS = [
  "support-triage-bot",
  "invoice-reconciler",
  "kyc-verifier",
  "acme-refund-agent",
  "acme-fraud-screen",
  "globex-helpdesk",
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function deleteRuns(runIds) {
  if (runIds.length === 0) return;
  await client.query(`DELETE FROM event_embeddings WHERE event_id IN (SELECT id FROM events WHERE run_id = ANY($1))`, [runIds]);
  await client.query(`DELETE FROM replays WHERE fork_id IN (SELECT id FROM forks WHERE original_run = ANY($1) OR new_run = ANY($1))`, [runIds]);
  await client.query(`DELETE FROM forks WHERE original_run = ANY($1) OR new_run = ANY($1)`, [runIds]);
  await client.query(`DELETE FROM memories WHERE run_id = ANY($1)`, [runIds]);
  await client.query(`UPDATE runs SET forked_from = NULL WHERE forked_from IN (SELECT id FROM events WHERE run_id = ANY($1))`, [runIds]);
  await client.query(`DELETE FROM events WHERE run_id = ANY($1)`, [runIds]);
  await client.query(`DELETE FROM audit_log WHERE target = ANY($1::STRING[])`, [runIds]);
  await client.query(`DELETE FROM runs WHERE id = ANY($1)`, [runIds]);
}

async function runsForOwner(owner) {
  return (await client.query(`SELECT r.id FROM runs r JOIN agents a ON a.id = r.agent_id WHERE a.owner = $1`, [owner])).rows.map((r) => r.id);
}
async function runsForSlugs(slugs) {
  return (await client.query(`SELECT r.id FROM runs r JOIN agents a ON a.id = r.agent_id WHERE a.slug = ANY($1)`, [slugs])).rows.map((r) => r.id);
}

if (mode === "all") {
  if (!yes) {
    console.log("Refusing: `all` wipes EVERYTHING (including real embeddings). Re-run with --yes.");
    await client.end();
    process.exit(1);
  }
  await client.query(`TRUNCATE agents, runs, events, event_embeddings, memories, forks, replays, audit_log CASCADE`);
  console.log("✅ wiped all data (schema intact). Re-seed: refund agent → embed → backfill → seed-tenants → seed-failures.");
} else if (mode === "synthetic") {
  const ids = await runsForOwner("backfill");
  await deleteRuns(ids);
  await client.query(`DELETE FROM agents WHERE owner = 'backfill'`);
  console.log(`✅ removed ${ids.length} synthetic-backfill runs and their agents.`);
} else if (mode === "seed") {
  const ids = await runsForSlugs(SEED_SLUGS);
  await deleteRuns(ids);
  await client.query(`DELETE FROM agents WHERE slug = ANY($1)`, [SEED_SLUGS]);
  console.log(`✅ removed ${ids.length} seeded tenant runs and their agents.`);
} else {
  console.log("usage: node scripts/reset-db.mjs <synthetic|seed|all --yes>");
  process.exit(1);
}

await client.end();
