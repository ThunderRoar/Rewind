import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { embed } from "../bedrock.js";
import { getPool } from "../db.js";

const SearchBody = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(100).optional(),
  runId: z.string().uuid().optional(),
  excludeSynthetic: z.boolean().optional(),
});

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.post("/search", async (req, reply) => {
    const parsed = SearchBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_body", details: parsed.error.flatten() };
    }
    const { query, limit = 20, runId, excludeSynthetic } = parsed.data;

    let vector: number[];
    try {
      vector = await embed(query);
    } catch (err) {
      reply.code(502);
      return { error: "embed_failed", message: err instanceof Error ? err.message : String(err) };
    }

    const params: unknown[] = [`[${vector.join(",")}]`];
    const where: string[] = [];
    if (runId) {
      params.push(runId);
      where.push(`e.run_id = $${params.length}`);
    }
    if (excludeSynthetic) {
      where.push(`r.label IS DISTINCT FROM 'synthetic-backfill'`);
    }
    // Company isolation + optional member (sub-agent) scope.
    params.push(req.orgScope ?? null);
    where.push(`($${params.length}::STRING IS NULL OR a.owner = $${params.length})`);
    params.push(req.agentScope ?? null);
    where.push(`($${params.length}::STRING IS NULL OR a.slug = $${params.length})`);
    params.push(limit);
    const limitParam = `$${params.length}`;
    // Over-fetch nearest neighbours so post-filters still fill the result page.
    const pool = Math.max(limit * 8, 60);

    // The vector top-k runs FIRST, in its own CTE, so the planner uses the
    // distributed vector index (event_embedding_idx) instead of full-scanning.
    // <=> is cosine distance, matching the vector_cosine_ops index.
    const sql = `
      WITH nn AS (
        SELECT event_id, embedding <=> $1::VECTOR AS distance
        FROM event_embeddings
        ORDER BY embedding <=> $1::VECTOR
        LIMIT ${pool}
      )
      SELECT e.id, e.run_id, e.seq, e.kind, e.ts, ee.summary, nn.distance
      FROM nn
      JOIN events e ON e.id = nn.event_id
      JOIN event_embeddings ee ON ee.event_id = nn.event_id
      JOIN runs r ON r.id = e.run_id
      JOIN agents a ON a.id = r.agent_id
      WHERE ${where.join(" AND ")}
      ORDER BY nn.distance
      LIMIT ${limitParam}`;

    const { rows } = await getPool().query(sql, params);
    return { query, results: rows };
  });

  app.post("/similar-failures", async (req, reply) => {
    const Body = z.object({
      context: z.string().min(1),
      limit: z.number().int().positive().max(50).optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_body", details: parsed.error.flatten() };
    }
    const { context, limit = 5 } = parsed.data;

    let vector: number[];
    try {
      vector = await embed(context);
    } catch (err) {
      reply.code(502);
      return { error: "embed_failed", message: err instanceof Error ? err.message : String(err) };
    }
    const literal = `[${vector.join(",")}]`;

    // A "failure" = a run that a human flagged and corrected via a fork
    // (it appears as forks.original_run). DISTINCT ON dedups to the single
    // nearest event per run, then we order runs by that best distance.
    const { rows } = await getPool().query(
      `SELECT * FROM (
         SELECT DISTINCT ON (e.run_id)
           e.run_id, r.label, ee.summary, ee.embedding <=> $1::VECTOR AS distance
         FROM event_embeddings ee
         JOIN events e ON e.id = ee.event_id
         JOIN runs r ON r.id = e.run_id
         WHERE e.run_id IN (
           SELECT original_run FROM forks WHERE ($2::STRING IS NULL OR created_by = $2)
         )
         ORDER BY e.run_id, ee.embedding <=> $1::VECTOR
       ) sub
       ORDER BY distance
       LIMIT $3`,
      [literal, req.orgScope ?? null, limit]
    );
    return { context, failures: rows };
  });
}
