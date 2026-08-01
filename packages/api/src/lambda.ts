import awsLambdaFastify from "@fastify/aws-lambda";
import { buildApp } from "./app.js";
import { getPool } from "./db.js";

// Lambda entrypoint (bundled handler = index.handler). Config comes from process.env.
const proxy = awsLambdaFastify(buildApp());

export const handler = async (event: unknown, context: unknown): Promise<unknown> => {
  // Keep-warm ping: an EventBridge scheduled invoke sends {"warm": true}. Touch the
  // DB pool so the container AND the CockroachDB connection stay hot, then return —
  // without routing a non-HTTP event through Fastify (avoids error-log noise).
  if ((event as { warm?: boolean })?.warm === true) {
    try {
      await getPool().query("SELECT 1");
    } catch {
      /* ignore — warming is best-effort */
    }
    return { warmed: true };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return proxy(event as any, context as any);
};
