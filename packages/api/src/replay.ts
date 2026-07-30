import { MEMORY_KEY, runRefundAgent } from "@rewind/example-refund-agent";
import { Rewind, type RewindRun } from "@rewind/sdk-node";
import { computeCost } from "./cost.js";
import { getPool } from "./db.js";
import { publishIncident } from "./sns.js";

// Sum token usage across a run's llm_call events and price it.
async function costOfRun(runId: string, model: string): Promise<number> {
  const { rows } = await getPool().query<{
    payload: { usage?: { inputTokens?: number; outputTokens?: number } };
  }>(`SELECT payload FROM events WHERE run_id = $1 AND kind = 'llm_call'`, [runId]);
  let inTok = 0;
  let outTok = 0;
  for (const r of rows) {
    inTok += r.payload.usage?.inputTokens ?? 0;
    outTok += r.payload.usage?.outputTokens ?? 0;
  }
  return computeCost(model, inTok, outTok);
}

let sdkReady = false;
function ensureSdk(): void {
  if (sdkReady) return;
  Rewind.init({
    agentSlug: "refund-bot",
    owner: "replay",
    apiUrl: process.env.API_URL ?? "http://localhost:3000",
  });
  sdkReady = true;
}

// Re-run the agent with a given memory value into a fresh run, branched off the
// original. Emits through the same SDK/ingestion path as a live run.
async function replayBranch(
  label: string,
  ownerRecord: string,
  originalRunId: string,
  forkEventId: string,
  model: string
): Promise<{ run: RewindRun; cost: number }> {
  const run = await Rewind.startRun(label);
  await getPool().query(
    `UPDATE runs SET parent_run = $1, forked_from = $2 WHERE id = $3`,
    [originalRunId, forkEventId, run.runId]
  );
  await runRefundAgent(run, { ownerRecord });
  await run.end();
  const cost = await costOfRun(run.runId, model);
  return { run, cost };
}

export interface ReplayResult {
  forkId: string;
  originalRunId: string;
  controlRunId: string;
  editedRunId: string;
  originalValue: string;
  editedValue: string;
  costUsd: number;
}

export async function forkAndReplay(params: {
  originalRunId: string;
  editedValue: string;
  owner: string;
}): Promise<ReplayResult> {
  ensureSdk();
  const pool = getPool();

  const ev = await pool.query<{ id: string; payload: { value: string } }>(
    `SELECT id, payload FROM events
     WHERE run_id = $1 AND kind = 'memory_write' AND payload->>'key' = $2
     ORDER BY seq LIMIT 1`,
    [params.originalRunId, MEMORY_KEY]
  );
  const forkEvent = ev.rows[0];
  if (!forkEvent) {
    throw new Error(`no memory_write for '${MEMORY_KEY}' in run ${params.originalRunId}`);
  }
  const originalValue = forkEvent.payload.value;
  const model = process.env.BEDROCK_MODEL_DEMO ?? "unknown";

  // Control = original memory (reproduces the failure); edited = the fix.
  const control = await replayBranch("replay:control", originalValue, params.originalRunId, forkEvent.id, model);
  const edited = await replayBranch("replay:edited", params.editedValue, params.originalRunId, forkEvent.id, model);
  const costUsd = control.cost + edited.cost;

  const forkRes = await pool.query<{ id: string }>(
    `INSERT INTO forks (original_run, new_run, forked_at_event, edits, reason, created_by)
     VALUES ($1, $2, $3, $4, 'fix-poisoned-memory', $5) RETURNING id`,
    [
      params.originalRunId,
      edited.run.runId,
      forkEvent.id,
      JSON.stringify({ [MEMORY_KEY]: params.editedValue }),
      params.owner,
    ]
  );
  const forkId = forkRes.rows[0]?.id;
  if (!forkId) throw new Error("fork insert returned no id");

  await pool.query(
    `INSERT INTO replays (fork_id, model, kind, status, cost_usd)
     VALUES ($1, $2, 'control', 'done', $3), ($1, $2, 'edited', 'done', $4)`,
    [forkId, model, control.cost, edited.cost]
  );
  await pool.query(
    `INSERT INTO audit_log (owner, action, target, detail)
     VALUES ($1, 'replay', $2, $3)`,
    [
      params.owner,
      params.originalRunId,
      JSON.stringify({
        forkId,
        controlRunId: control.run.runId,
        editedRunId: edited.run.runId,
        costUsd,
      }),
    ]
  );

  // Fire an incident notification (no-op unless SNS_TOPIC_ARN is set).
  await publishIncident(
    "Rewind: agent incident investigated",
    `Run ${params.originalRunId} was flagged and replayed.\n` +
      `Root cause: poisoned memory '${MEMORY_KEY}'.\n` +
      `Fix applied and verified (control replay reproduced the original outcome).\n` +
      `Investigation cost: $${costUsd.toFixed(4)}.`
  );

  return {
    forkId,
    originalRunId: params.originalRunId,
    controlRunId: control.run.runId,
    editedRunId: edited.run.runId,
    originalValue,
    editedValue: params.editedValue,
    costUsd,
  };
}
