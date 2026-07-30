import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { getPool } from "./db.js";
import { eventsRoutes } from "./routes/events.js";
import { observabilityRoutes } from "./routes/observability.js";
import { readRoutes } from "./routes/read.js";
import { replayRoutes } from "./routes/replay.js";
import { runsRoutes } from "./routes/runs.js";
import { searchRoutes } from "./routes/search.js";

// Build the app without listening, so the same instance can be wrapped by
// @fastify/aws-lambda for the Lambda deployment.
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  });

  app.register(cors, { origin: true });
  app.register(runsRoutes);
  app.register(eventsRoutes);
  app.register(readRoutes);
  app.register(searchRoutes);
  app.register(replayRoutes);
  app.register(observabilityRoutes);

  // Liveness (no DB).
  app.get("/health/live", async () => ({ status: "ok" }));

  // Readiness: queries CockroachDB, 503 if unreachable.
  app.get("/health", async (req, reply) => {
    try {
      const { rows } = await getPool().query<{
        ok: number;
        db_version: string;
        ts: string;
      }>("SELECT 1 AS ok, version() AS db_version, now() AS ts");
      const row = rows[0];
      return {
        status: "ok",
        db: "cockroachdb",
        db_version: row?.db_version,
        ts: row?.ts,
      };
    } catch (err) {
      req.log.error({ err }, "health check: cockroachdb unreachable");
      reply.code(503);
      return {
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

  return app;
}
