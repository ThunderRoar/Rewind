import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";

export async function observabilityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/stats", async (req) => {
    const org = req.orgScope ?? null;
    const agent = req.agentScope ?? null;
    // All workspace metrics are per-company for consistency. `index_size` is the
    // separate, cluster-wide vector-index scale (shared infra, shown by search).
    const { rows } = await getPool().query(
      `SELECT
         (SELECT count(*)::int FROM runs r JOIN agents a ON a.id = r.agent_id
            WHERE a.owner IS DISTINCT FROM 'backfill'
              AND ($1::STRING IS NULL OR a.owner = $1)
              AND ($2::STRING IS NULL OR a.slug = $2)) AS runs,
         (SELECT count(*)::int FROM events ev
            JOIN runs r ON r.id = ev.run_id JOIN agents a ON a.id = r.agent_id
            WHERE a.owner IS DISTINCT FROM 'backfill'
              AND ($1::STRING IS NULL OR a.owner = $1)
              AND ($2::STRING IS NULL OR a.slug = $2)) AS events,
         (SELECT count(*)::int FROM event_embeddings) AS index_size,
         (SELECT count(*)::int FROM forks
            WHERE ($1::STRING IS NULL OR created_by = $1)) AS forks,
         (SELECT count(*)::int FROM replays rp JOIN forks f ON f.id = rp.fork_id
            WHERE ($1::STRING IS NULL OR f.created_by = $1)) AS replays,
         (SELECT coalesce(sum(rp.cost_usd), 0)::float FROM replays rp JOIN forks f ON f.id = rp.fork_id
            WHERE ($1::STRING IS NULL OR f.created_by = $1)) AS total_cost`,
      [org, agent]
    );
    return rows[0];
  });

  app.get("/audit", async (req) => {
    const { rows } = await getPool().query(
      `SELECT owner, action, target, detail, ts
       FROM audit_log
       WHERE ($1::STRING IS NULL OR owner = $1)
       ORDER BY ts DESC LIMIT 50`,
      [req.orgScope ?? null]
    );
    return { entries: rows };
  });
}
