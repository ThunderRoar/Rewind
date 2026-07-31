import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { forkAndReplay } from "../replay.js";

const ReplayBody = z.object({
  runId: z.string().uuid(),
  editedValue: z.string().min(1),
  owner: z.string().min(1).default("demo"),
});

export async function replayRoutes(app: FastifyInstance): Promise<void> {
  // Fork the run at its poisoned memory + run control and edited replays.
  // Synchronous (~20-40s): re-runs the agent through Bedrock twice.
  app.post("/replay", async (req, reply) => {
    const parsed = ReplayBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_body", details: parsed.error.flatten() };
    }
    const owner = req.orgScope ?? (req.headers["x-owner"] as string | undefined) ?? parsed.data.owner;
    try {
      return await forkAndReplay({
        originalRunId: parsed.data.runId,
        editedValue: parsed.data.editedValue,
        owner,
      });
    } catch (err) {
      req.log.error({ err }, "POST /replay failed");
      reply.code(500);
      return { error: "replay_failed", message: err instanceof Error ? err.message : String(err) };
    }
  });
}
