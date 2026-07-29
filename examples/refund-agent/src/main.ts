import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load repo-root .env before importing anything that constructs a Bedrock client.
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
  dotenv.config();
}
loadRootEnv();

const { Rewind } = await import("@rewind/sdk-node");
const { runRefundAgent, TRUE_OWNER, POISONED_OWNER } = await import("./agent.js");
const { refundLedger } = await import("./tools.js");

Rewind.init({
  agentSlug: "refund-bot",
  owner: "demo",
  apiUrl: process.env.API_URL ?? "http://localhost:3000",
});

// Clean run: the true ownership record (1001) -> agent refuses the 1002 refund.
const clean = await Rewind.startRun("refund-clean");
console.log("clean runId:", clean.runId);
console.log("CLEAN result:", await runRefundAgent(clean, { ownerRecord: TRUE_OWNER }));
await clean.end();

// Poisoned run: the false ownership record (1002) -> agent wrongly approves.
const poisoned = await Rewind.startRun("refund-poisoned");
console.log("poisoned runId:", poisoned.runId);
console.log("POISONED result:", await runRefundAgent(poisoned, { ownerRecord: POISONED_OWNER }));
await poisoned.end();

console.log("mock refund ledger:", refundLedger);
