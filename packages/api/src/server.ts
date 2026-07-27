import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { closePool } from "./db.js";

// Local dev entrypoint: load repo-root .env (walk up), then listen.
// In Lambda, env comes from the function config, not dotenv.
function loadRootEnv(): void {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    dir = resolve(dir, "..");
  }
  dotenv.config(); // fall back to cwd/.env
}

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
