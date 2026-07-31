import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readRoutes(app: FastifyInstance): Promise<void> {
  app.get("/runs", async () => {
    const { rows } = await getPool().query(
      `SELECT r.id, r.label, r.status, r.region, r.created_at,
              r.parent_run, r.forked_from,
              a.slug AS agent_slug,
              (SELECT count(*) FROM events e WHERE e.run_id = r.id) AS event_count
       FROM runs r JOIN agents a ON a.id = r.agent_id
       ORDER BY r.created_at DESC
       LIMIT 100`
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
                a.slug AS agent_slug
         FROM runs r JOIN agents a ON a.id = r.agent_id WHERE r.id = $1`,
        [id]
      );
      const run = runRes.rows[0];
      if (!run) {
        reply.code(404);
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
