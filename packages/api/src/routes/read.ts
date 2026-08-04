import { MEMORY_KEY } from "@rewind/example-refund-agent";
import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readRoutes(app: FastifyInstance): Promise<void> {
  app.get("/runs", async (req) => {
    const org = req.orgScope ?? null; // null in dev (auth off) => unscoped
    const agent = req.agentScope ?? null;
    const { rows } = await getPool().query(
      `SELECT r.id, r.label, r.status, r.region, r.created_at,
              r.parent_run, r.forked_from,
              a.slug AS agent_slug,
              (SELECT count(*) FROM events e WHERE e.run_id = r.id) AS event_count
       FROM runs r JOIN agents a ON a.id = r.agent_id
       WHERE a.owner IS DISTINCT FROM 'backfill'   -- keep synthetic events in the index, out of the list
         AND ($1::STRING IS NULL OR a.owner = $1)  -- company isolation
         AND ($2::STRING IS NULL OR a.slug = $2)   -- member scoped to one sub-agent
       ORDER BY r.created_at DESC
       LIMIT 100`,
      [org, agent]
    );
    return { runs: rows };
  });

  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    "/runs/:id",
    async (req, reply) => {
      const { id } = req.params;
      if (!UUID.test(id)) {
        reply.code(400);
        return { error: "invalid_run_id" };
      }
      const limit = Math.min(Number(req.query.limit ?? 2000) || 2000, 5000);
      const pool = getPool();

      const runRes = await pool.query(
        `SELECT r.id, r.label, r.status, r.region, r.created_at, r.parent_run, r.forked_from,
                a.slug AS agent_slug,
                -- replayable only if it carries the memory the shipped agent loop keys off
                EXISTS (
                  SELECT 1 FROM events e
                  WHERE e.run_id = r.id AND e.kind = 'memory_write'
                    AND e.payload->>'key' = $4
                ) AS replayable
         FROM runs r JOIN agents a ON a.id = r.agent_id
         WHERE r.id = $1
           AND ($2::STRING IS NULL OR a.owner = $2)
           AND ($3::STRING IS NULL OR a.slug = $3)`,
        [id, req.orgScope ?? null, req.agentScope ?? null, MEMORY_KEY]
      );
      const run = runRes.rows[0];
      if (!run) {
        reply.code(404); // also covers cross-company access
        return { error: "run_not_found" };
      }

      const events = await pool.query(
        `SELECT id, seq, parent_event, kind, payload, payload_sha, s3_overflow, ts
         FROM events WHERE run_id = $1 ORDER BY seq LIMIT $2`,
        [id, limit]
      );
      return { run, events: events.rows };
    }
  );
}
