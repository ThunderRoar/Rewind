import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPool } from "../db.js";

const CreateRunBody = z.object({
  agentSlug: z.string().min(1),
  owner: z.string().min(1),
  label: z.string().optional(),
  region: z.string().min(1).default("us-east-1"),
});

export async function runsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/runs", async (req, reply) => {
    const parsed = CreateRunBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_body", details: parsed.error.flatten() };
    }
    const { agentSlug, owner, label, region } = parsed.data;

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      // no-op UPDATE so RETURNING returns the id whether inserted or existing
      const agentRes = await client.query<{ id: string }>(
        `INSERT INTO agents (slug, owner) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
         RETURNING id`,
        [agentSlug, owner]
      );
      const agentId = agentRes.rows[0]?.id;
      if (!agentId) throw new Error("agent upsert returned no id");

      const runRes = await client.query<{ id: string }>(
        `INSERT INTO runs (agent_id, label, status, region)
         VALUES ($1, $2, 'live', $3)
         RETURNING id`,
        [agentId, label ?? null, region]
      );
      const runId = runRes.rows[0]?.id;
      if (!runId) throw new Error("run insert returned no id");

      await client.query("COMMIT");
      reply.code(201);
      return { runId, agentId };
    } catch (err) {
      await client.query("ROLLBACK");
      // Driver errors can carry schema/connection detail — log it, don't return it.
      req.log.error({ err }, "POST /runs failed");
      reply.code(500);
      return { error: "internal", message: "Could not create run. See server logs." };
    } finally {
      client.release();
    }
  });
}
