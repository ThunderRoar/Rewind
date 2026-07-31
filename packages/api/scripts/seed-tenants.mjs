// Seed a realistic, multi-tenant, time-varied dataset so the demo looks like a
// live platform: several agents across a few orgs, with events and a busy audit
// log. These are real rows in CockroachDB (reproducible), not on-screen fictions.
//   node packages/api/scripts/seed-tenants.mjs
import pg from "pg";
import dotenv from "dotenv";
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

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const DAY = 86400000;
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();

// canonical (key-sorted) JSON sha256 — matches the API's content-address
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",")}}`;
  }
  return JSON.stringify(v);
}
const sha = (p) => crypto.createHash("sha256").update(canon(p)).digest("hex");

async function upsertAgent(slug, owner) {
  const r = await client.query(
    `INSERT INTO agents (slug, owner) VALUES ($1,$2)
     ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug RETURNING id`,
    [slug, owner]
  );
  return r.rows[0].id;
}

async function insertRun(agentId, label, status, createdAt) {
  const r = await client.query(
    `INSERT INTO runs (agent_id, label, status, region, created_at)
     VALUES ($1,$2,$3,'us-east-1',$4) RETURNING id`,
    [agentId, label, status, iso(createdAt)]
  );
  return r.rows[0].id;
}

async function insertEvents(runId, events, baseTs) {
  let seq = 0;
  for (const [kind, payload] of events) {
    await client.query(
      `INSERT INTO events (run_id, seq, kind, payload, payload_sha, ts)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [runId, seq, kind, payload, sha(payload), iso(baseTs + seq * 1400)]
    );
    seq++;
  }
}

async function audit(owner, action, target, detail, ts) {
  await client.query(
    `INSERT INTO audit_log (owner, action, target, detail, ts) VALUES ($1,$2,$3,$4,$5)`,
    [owner, action, target, detail, iso(ts)]
  );
}

// ── Tenants ──────────────────────────────────────────────
const TENANTS = [
  {
    owner: "me",
    agents: [
      {
        slug: "support-triage-bot",
        runs: [
          { label: "triage-2291", daysAgo: 0.2, status: "complete", events: [
            ["llm_call", { model: "haiku", summary: "classify inbound ticket #2291" }],
            ["tool_call", { tool: "lookup_order", args: { order: "SO-8841" } }],
            ["tool_result", { tool: "lookup_order", result: { status: "delivered" } }],
            ["memory_write", { key: "ticket:2291:sentiment", value: "frustrated" }],
            ["observation", { note: "routed to tier-2, refund not required" }],
          ]},
          { label: "triage-2288", daysAgo: 1.1, status: "complete", events: [
            ["llm_call", { model: "haiku", summary: "classify inbound ticket #2288" }],
            ["tool_call", { tool: "lookup_order", args: { order: "SO-8830" } }],
            ["tool_result", { tool: "lookup_order", result: { status: "lost_in_transit" } }],
            ["observation", { note: "escalated to logistics" }],
          ]},
        ],
      },
      {
        slug: "invoice-reconciler",
        runs: [
          { label: "recon-mar-batch-7", daysAgo: 0.6, status: "complete", events: [
            ["tool_call", { tool: "fetch_invoices", args: { vendor: "Northwind", month: "2026-03" } }],
            ["tool_result", { tool: "fetch_invoices", result: { count: 42 } }],
            ["memory_read", { key: "vendor:northwind:terms", value: "net-30, 2% early" }],
            ["llm_call", { model: "haiku", summary: "match 42 invoices to POs" }],
            ["tool_call", { tool: "flag_discrepancy", args: { invoice: "INV-3391", delta: 118.4 } }],
            ["observation", { note: "1 discrepancy flagged, 41 reconciled" }],
          ]},
          { label: "recon-mar-batch-6", daysAgo: 2.4, status: "complete", events: [
            ["tool_call", { tool: "fetch_invoices", args: { vendor: "Initech", month: "2026-03" } }],
            ["tool_result", { tool: "fetch_invoices", result: { count: 17 } }],
            ["llm_call", { model: "haiku", summary: "match 17 invoices to POs" }],
            ["observation", { note: "all reconciled" }],
          ]},
        ],
      },
      {
        slug: "kyc-verifier",
        runs: [
          { label: "kyc-applicant-5521", daysAgo: 0.35, status: "complete", events: [
            ["tool_call", { tool: "id_check", args: { applicant: 5521 } }],
            ["tool_result", { tool: "id_check", result: { match: true, score: 0.94 } }],
            ["memory_write", { key: "kyc:5521:status", value: "verified" }],
            ["llm_call", { model: "haiku", summary: "assess risk for applicant 5521" }],
            ["observation", { note: "low risk, approved" }],
          ]},
          { label: "kyc-applicant-5519", daysAgo: 3.2, status: "complete", events: [
            ["tool_call", { tool: "id_check", args: { applicant: 5519 } }],
            ["tool_result", { tool: "id_check", result: { match: false, score: 0.41 } }],
            ["memory_write", { key: "kyc:5519:status", value: "manual_review" }],
            ["observation", { note: "flagged for manual review" }],
          ]},
        ],
      },
    ],
  },
  {
    owner: "acme-fintech",
    agents: [
      {
        slug: "acme-refund-agent",
        runs: [
          { label: "acme-refund-9931", daysAgo: 0.9, status: "complete", events: [
            ["llm_call", { model: "haiku", summary: "evaluate refund request 9931" }],
            ["tool_call", { tool: "customer_lookup", args: { id: 7712 } }],
            ["memory_read", { key: "order:X-31:owner", value: "customer 7712" }],
            ["tool_call", { tool: "issue_refund", args: { amount: 129.99, to: 7712 } }],
            ["observation", { note: "refund issued, ownership verified" }],
          ]},
          { label: "acme-refund-9928", daysAgo: 4.1, status: "complete", events: [
            ["llm_call", { model: "haiku", summary: "evaluate refund request 9928" }],
            ["tool_call", { tool: "customer_lookup", args: { id: 7705 } }],
            ["observation", { note: "policy denied, outside window" }],
          ]},
        ],
      },
      {
        slug: "acme-fraud-screen",
        runs: [
          { label: "fraud-screen-batch-88", daysAgo: 1.7, status: "complete", events: [
            ["tool_call", { tool: "score_txn", args: { txn: "T-55210" } }],
            ["tool_result", { tool: "score_txn", result: { risk: 0.88 } }],
            ["memory_read", { key: "blocklist:cards", value: "…" }],
            ["observation", { note: "transaction blocked, high risk" }],
          ]},
        ],
      },
    ],
  },
  {
    owner: "globex-support",
    agents: [
      {
        slug: "globex-helpdesk",
        runs: [
          { label: "helpdesk-4410", daysAgo: 0.5, status: "complete", events: [
            ["llm_call", { model: "haiku", summary: "answer billing question #4410" }],
            ["tool_call", { tool: "kb_search", args: { q: "proration policy" } }],
            ["tool_result", { tool: "kb_search", result: { hits: 3 } }],
            ["observation", { note: "resolved with KB article" }],
          ]},
          { label: "helpdesk-4402", daysAgo: 2.9, status: "complete", events: [
            ["llm_call", { model: "haiku", summary: "answer billing question #4402" }],
            ["tool_call", { tool: "kb_search", args: { q: "seat downgrade" } }],
            ["observation", { note: "escalated to account manager" }],
          ]},
        ],
      },
    ],
  },
];

let runCount = 0;
let eventCount = 0;
const runIds = [];
for (const t of TENANTS) {
  for (const a of t.agents) {
    const agentId = await upsertAgent(a.slug, t.owner);
    for (const run of a.runs) {
      const createdAt = now - run.daysAgo * DAY;
      const runId = await insertRun(agentId, run.label, run.status, createdAt);
      await insertEvents(runId, run.events, createdAt);
      runIds.push({ owner: t.owner, runId, label: run.label });
      runCount++;
      eventCount += run.events.length;
    }
  }
}

// ── Busy audit log across tenants and time ───────────────
const ACTIONS = ["search", "fork", "replay", "edit_memory", "search", "replay"];
let auditCount = 0;
for (let i = 0; i < 28; i++) {
  const pick = runIds[i % runIds.length];
  const action = ACTIONS[i % ACTIONS.length];
  const ts = now - (i * 0.31 + Math.random()) * DAY;
  await audit(
    pick.owner,
    action,
    pick.runId,
    { via: i % 2 ? "web" : "mcp", note: `${action} on ${pick.label}` },
    ts
  );
  auditCount++;
}

console.log(`\n✅ seeded ${runCount} runs, ${eventCount} events, ${auditCount} audit entries`);
console.log(`   owners: ${[...new Set(TENANTS.map((t) => t.owner))].join(", ")}\n`);

await client.end();
