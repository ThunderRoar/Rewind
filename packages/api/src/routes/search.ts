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
    params.push(limit);
    const limitParam = `$${params.length}`;

    // <=> is cosine distance, matching the vector_cosine_ops index.
    const sql = `
      SELECT e.id, e.run_id, e.seq, e.kind, e.ts, ee.summary,
             ee.embedding <=> $1::VECTOR AS distance
      FROM event_embeddings ee
      JOIN events e ON e.id = ee.event_id
      ${excludeSynthetic ? "JOIN runs r ON r.id = e.run_id" : ""}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ee.embedding <=> $1::VECTOR
      LIMIT ${limitParam}`;

    const { rows } = await getPool().query(sql, params);
    return { query, results: rows };
  });
}
