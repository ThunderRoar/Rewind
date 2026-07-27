import { buildApp } from "./app.js";
import { closePool } from "./db.js";
import { loadRootEnv } from "./env.js";

loadRootEnv();

const port = Number(process.env.API_PORT ?? 3000);
const app = buildApp();

app
  .listen({ port, host: "0.0.0.0" })
  .then((address) => app.log.info(`Rewind API listening on ${address}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

async function shutdown(signal: string): Promise<void> {
  app.log.info(`${signal} received — shutting down`);
  await app.close();
  await closePool();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
