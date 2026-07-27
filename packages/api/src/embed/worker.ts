import { embed, summarize } from "../bedrock.js";
import { getPool } from "../db.js";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function embedPendingBatch(limit = 50): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query<{ id: string; kind: string; payload: unknown }>(
    `SELECT e.id, e.kind, e.payload
     FROM events e
     LEFT JOIN event_embeddings ee ON ee.event_id = e.id
     WHERE ee.event_id IS NULL
     ORDER BY e.ts
     LIMIT $1`,
    [limit]
  );

  for (const row of rows) {
    const text = `${row.kind}: ${JSON.stringify(row.payload).slice(0, 2000)}`;
    const summary = await summarize(text);
    const vector = await embed(summary);
    // CockroachDB VECTOR accepts the pgvector text format: '[0.1,0.2,...]'.
    const literal = `[${vector.join(",")}]`;
    await pool.query(
      `INSERT INTO event_embeddings (event_id, embedding, summary)
       VALUES ($1, $2::VECTOR, $3)
       ON CONFLICT (event_id) DO NOTHING`,
      [row.id, literal, summary]
    );
  }
  return rows.length;
}

// Dev loop; in prod this is a scheduled Lambda calling embedPendingBatch() once.
export async function runEmbeddingWorker(): Promise<void> {
  console.log("[embed] worker started");
  for (;;) {
    try {
      const n = await embedPendingBatch(50);
      if (n === 0) await sleep(2000);
      else console.log(`[embed] embedded ${n} events`);
    } catch (err) {
      console.error("[embed] error:", err instanceof Error ? err.message : err);
      await sleep(5000);
    }
  }
}
