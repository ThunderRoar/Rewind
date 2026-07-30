import type { FastifyInstance } from "fastify";
import { getPool } from "../db.js";

export async function observabilityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/stats", async () => {
    const { rows } = await getPool().query(
      `SELECT
         (SELECT count(*)::int FROM runs) AS runs,
         (SELECT count(*)::int FROM events) AS events,
         (SELECT count(*)::int FROM forks) AS forks,
         (SELECT count(*)::int FROM replays) AS replays,
         (SELECT coalesce(sum(cost_usd), 0)::float FROM replays) AS total_cost`
    );
    return rows[0];
  });

  app.get("/audit", async () => {
    const { rows } = await getPool().query(
      `SELECT owner, action, target, detail, ts
       FROM audit_log ORDER BY ts DESC LIMIT 50`
    );
    return { entries: rows };
  });
}
