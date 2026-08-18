import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { forkAndReplay, RunNotVisibleError } from "../replay.js";
import { getPool } from "../db.js";

const ReplayBody = z.object({
  runId: z.string().uuid(),
  editedValue: z.string().min(1).max(2000),
  owner: z.string().min(1).max(200).default("demo"),
});

const DEMO_HOURLY_USD_CAP = Number(process.env.REPLAY_DEMO_HOURLY_USD_CAP ?? "0.25");
const DEMO_DAILY_USD_CAP = Number(process.env.REPLAY_DEMO_DAILY_USD_CAP ?? "2.00");

async function demoSpend(): Promise<{ hour: number; day: number }> {
  const { rows } = await getPool().query<{ hour: string; day: string }>(
    `SELECT coalesce(sum(cost_usd) FILTER (WHERE started_at > now() - INTERVAL '1 hour'), 0)::STRING AS hour,
            coalesce(sum(cost_usd), 0)::STRING AS day
     FROM replays WHERE started_at > now() - INTERVAL '24 hours'`
  );
  return { hour: Number(rows[0]?.hour ?? 0), day: Number(rows[0]?.day ?? 0) };
}

export async function replayRoutes(app: FastifyInstance): Promise<void> {
  // Fork the run at its poisoned memory + run control and edited replays.
  // Synchronous (~20-40s): re-runs the agent through Bedrock twice.
  app.post("/replay", async (req, reply) => {
    const parsed = ReplayBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_body", details: parsed.error.flatten() };
    }

    if (req.role === "demo") {
      const spend = await demoSpend();
      const exceeded =
        spend.day >= DEMO_DAILY_USD_CAP
          ? { window: "day", spent: spend.day, cap: DEMO_DAILY_USD_CAP, retryAfter: 86400 }
          : spend.hour >= DEMO_HOURLY_USD_CAP
            ? { window: "hour", spent: spend.hour, cap: DEMO_HOURLY_USD_CAP, retryAfter: 3600 }
            : null;
      if (exceeded) {
        reply.code(429).header("retry-after", String(exceeded.retryAfter));
        return {
          error: "replay_cap_reached",
          window: exceeded.window,
          spentUsd: Number(exceeded.spent.toFixed(4)),
          capUsd: exceeded.cap,
          message:
            `Public replay budget of $${exceeded.cap.toFixed(2)}/${exceeded.window} is exhausted ` +
            `($${exceeded.spent.toFixed(4)} spent). Replays are real Bedrock calls; the cap keeps ` +
            `the public demo key from draining the account. Admin keys are uncapped.`,
        };
      }
    }
    const owner = req.orgScope ?? (req.headers["x-owner"] as string | undefined) ?? parsed.data.owner;
    try {
      return await forkAndReplay({
        originalRunId: parsed.data.runId,
        editedValue: parsed.data.editedValue,
        owner,
        orgScope: req.orgScope ?? null,
        agentScope: req.agentScope ?? null,
      });
    } catch (err) {
      // 404 for both "missing" and "another tenant's" — same shape as GET /runs/:id,
      // so a caller can't use the response to probe for foreign run ids.
      if (err instanceof RunNotVisibleError) {
        reply.code(404);
        return { error: "run_not_found" };
      }
      const message = err instanceof Error ? err.message : String(err);
      // not-replayable is an expected boundary, not a server fault → 422, not 500
      if (/no memory_write for/.test(message)) {
        reply.code(422);
        return {
          error: "not_replayable",
          message:
            "This run is recorded and searchable, but replay is only available for instrumented agents whose loop Rewind ships (the refund agent). Its program can't be re-executed from events alone.",
        };
      }
      // Detail goes to the log, not to the caller — the demo key is public, and
      // driver errors can carry schema and connection detail.
      req.log.error({ err }, "POST /replay failed");
      reply.code(500);
      return { error: "replay_failed", message: "Replay failed. See server logs." };
    }
  });
}
