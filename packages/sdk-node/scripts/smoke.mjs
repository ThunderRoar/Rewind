// SDK smoke test. Requires the API running (pnpm dev:api) and the SDK built
// (pnpm --filter @rewind/sdk-node build).
// Run from repo root:  node packages/sdk-node/scripts/smoke.mjs
import { Rewind } from "../dist/index.js";

Rewind.init({
  agentSlug: "refund-bot",
  owner: "me",
  apiUrl: "http://localhost:3000",
});

const run = await Rewind.startRun("sdk-smoke");
console.log("runId:", run.runId);

run.emit("observation", { note: "sdk works" });
run.emit("llm_call", { model: "test", prompt: "hi" });
run.emit("tool_call", { tool: "customer_lookup", args: { id: 1234 } });
run.emit("tool_result", { tool: "customer_lookup", result: { name: "Jane" } });

await run.end(); // flush + stop timer
console.log("✅ flushed 4 events. Verify in Cockroach for the runId above.");
