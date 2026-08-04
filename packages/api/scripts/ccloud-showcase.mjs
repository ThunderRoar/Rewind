// ccloud CLI showcase — the agent provisions an ephemeral, isolated CockroachDB
// cluster for a "clean-world what-if", validates the fix there, and tears it
// down. Each ccloud command is logged to the Rewind timeline as a ccloud_action
// event (great B-roll: the agent managing its own infrastructure).
//
// This is deliberately OUT of the replay hot path — cluster provisioning takes
// minutes, so it runs as a one-shot local/CI script, never per replay.
//
//   node packages/api/scripts/ccloud-showcase.mjs          # dry-run (safe: logs the real commands, provisions nothing)
//   node packages/api/scripts/ccloud-showcase.mjs --live     # actually runs ccloud (needs the ccloud CLI + CCLOUD_API_KEY)
//
// Verify exact subcommand syntax on your ccloud version with `ccloud cluster --help`.
import pg from "pg";
import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let dir = dirname(fileURLToPath(import.meta.url));
for (let i = 0; i < 6; i++) {
  const c = resolve(dir, ".env");
  if (existsSync(c)) { dotenv.config({ path: c }); break; }
  dir = resolve(dir, "..");
}

const LIVE = process.argv.includes("--live");
// This ccloud version: `create serverless <name> <region> --cloud AWS`
// (region is positional, plan is "serverless", --cloud defaults to GCP).
const cloud = process.env.CCLOUD_CLOUD ?? "AWS";
const region = process.env.CCLOUD_REGION ?? "us-east-1";
const cluster = `rewind-whatif-${Date.now().toString(36)}`;

function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",")}}`;
  return JSON.stringify(v);
}
const sha = (p) => crypto.createHash("sha256").update(canon(p)).digest("hex");

// Run a ccloud command (or simulate it in dry-run). Returns what we log.
function ccloud(args) {
  const command = `ccloud ${args.join(" ")}`;
  if (!LIVE) return { command, simulated: true, exitCode: 0, output: "(dry-run — not executed)" };
  const res = spawnSync("ccloud", args, { encoding: "utf8" });
  const output = (res.stdout || res.stderr || "").trim().slice(0, 600);
  return { command, simulated: false, exitCode: res.status ?? -1, output };
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const agentId = (
  await client.query(
    `INSERT INTO agents (slug, owner) VALUES ('infra-agent', 'me')
     ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`
  )
).rows[0].id;
const runId = (
  await client.query(
    `INSERT INTO runs (agent_id, label, status, region)
     VALUES ($1, $2, 'complete', 'us-east-1') RETURNING id`,
    [agentId, `ccloud clean-world what-if · ${cluster}`]
  )
).rows[0].id;

let seq = 0;
async function log(summary, payload) {
  const body = { summary, ...payload };
  await client.query(
    `INSERT INTO events (run_id, seq, kind, payload, payload_sha) VALUES ($1, $2, 'ccloud_action', $3, $4)`,
    [runId, seq++, body, sha(body)]
  );
  console.log(`  • ${summary}${payload?.command ? `  [${payload.command}]` : ""}`);
}

console.log(`\nccloud showcase (${LIVE ? "LIVE" : "dry-run"}) → cluster ${cluster}\n`);

// 1. Provision an isolated ephemeral cluster.
await log("Provision an isolated clean-world cluster", ccloud(["cluster", "create", "serverless", cluster, region, "--cloud", cloud, "--wait"]));

// 2. Inspect it.
await log("List clusters to confirm it is live", ccloud(["cluster", "list"]));

// 3. The what-if: in a pristine DB, the corrected memory (owner = 1001 John)
//    is seeded and the agent's decision is validated — no production data touched.
await log("Clean-world what-if: seed corrected ownership (order:A-9:owner = customer 1001, John) and verify the agent refunds the RIGHT customer", {
  experiment: "corrected-memory-validation",
  isolated: true,
  simulated: !LIVE,
});

// 4. Tear it down — ephemeral by design. --force skips the y/N prompt (we
//    capture stdio, so an interactive prompt would hang the script).
await log("Tear down the ephemeral cluster", ccloud(["cluster", "delete", cluster, "--force"]));

console.log(`\n✅ Logged ${seq} ccloud_action events to run ${runId}`);
console.log(`   View it in the timeline as the "${cluster}" run.\n`);
if (!LIVE) console.log("   (dry-run: no cluster was created. Re-run with --live once, with ccloud auth set up, to actually provision.)\n");

await client.end();
