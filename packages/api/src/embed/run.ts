import { loadRootEnv } from "../env.js";

// Load .env before importing the worker (Bedrock client reads env at construction).
loadRootEnv();

const { runEmbeddingWorker } = await import("./worker.js");
await runEmbeddingWorker();
