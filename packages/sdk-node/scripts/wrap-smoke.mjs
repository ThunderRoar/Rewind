// Tests wrapTools without needing AWS. Requires API running + SDK built.
// Run from repo root:  node packages/sdk-node/scripts/wrap-smoke.mjs
import { Rewind } from "../dist/index.js";

Rewind.init({ agentSlug: "refund-bot", owner: "me" });
const run = await Rewind.startRun("wrap-smoke");

const tools = run.wrapTools({
  customer_lookup: async ({ id }) => ({ id, name: id === 1234 ? "Jane" : "John" }),
  issue_refund: async ({ amount }) => ({ ok: true, amount }),
});

await tools.customer_lookup({ id: 1234 }); // -> tool_call + tool_result
await tools.issue_refund({ amount: 42 }); //  -> tool_call + tool_result

await run.end();
console.log("✅ wrapTools emitted 4 events (2 tool_call + 2 tool_result) for runId:", run.runId);
