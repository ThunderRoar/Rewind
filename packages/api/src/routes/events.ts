import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPool } from "../db.js";
import { payloadSha } from "../hash.js";
import { isOverflow, putOverflow } from "../s3.js";

const EVENT_KINDS = [
  "llm_call",
  "tool_call",
  "tool_result",
  "memory_read",
  "memory_write",
  "observation",
  "ccloud_action",
] as const;

const EventInput = z.object({
  seq: z.number().int().nonnegative(),
  kind: z.enum(EVENT_KINDS),
  payload: z.record(z.string(), z.unknown()),
  parentEvent: z.string().uuid().nullish(),
});

const IngestBody = z.object({
  runId: z.string().uuid(),
  events: z.array(EventInput).min(1).max(500),
});

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/events", async (req, reply) => {
    const parsed = IngestBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_body", details: parsed.error.flatten() };
    }
    const { runId, events } = parsed.data;

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      for (const e of events) {
        const sha = payloadSha(e.payload);
        const json = JSON.stringify(e.payload);
        let storedPayload: unknown = e.payload;
        let s3uri: string | null = null;
        if (isOverflow(json)) {
          s3uri = await putOverflow(runId, e.seq, json);
          storedPayload = { _overflow: true, bytes: Buffer.byteLength(json, "utf8"), s3: s3uri };
        }
        await client.query(
          `INSERT INTO events (run_id, seq, parent_event, kind, payload, payload_sha, s3_overflow)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [runId, e.seq, e.parentEvent ?? null, e.kind, storedPayload, sha, s3uri]
        );
      }
      await client.query("COMMIT");
      reply.code(201);
      return { inserted: events.length };
    } catch (err) {
      await client.query("ROLLBACK");
      req.log.error({ err }, "POST /events failed");
      // A bad runId trips the events.run_id foreign key -> client error, not 500.
      const message = err instanceof Error ? err.message : String(err);
      const isFk = /foreign key|violates foreign/i.test(message);
      reply.code(isFk ? 400 : 500);
      return { error: isFk ? "invalid_run" : "internal", message };
    } finally {
      client.release();
    }
  });
}
