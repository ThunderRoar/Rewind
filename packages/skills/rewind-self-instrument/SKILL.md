---
name: rewind-self-instrument
description: Use when you want an AI agent to record its own decisions, tool calls, and memory reads/writes into Rewind (a CockroachDB-backed timeline) so the run can later be scrubbed, semantically searched, forked, and replayed. Apply when instrumenting a new agent for observability or time-travel debugging.
---

# Instrument an agent with Rewind

Rewind turns every agent action into an append-only, content-addressed event in CockroachDB. Once instrumented, a run can be scrubbed on a timeline, semantically searched, forked at any point, and replayed with an edited memory.

## Steps

1. **Install the SDK** and initialize once at startup:
   ```ts
   import { Rewind } from "@rewind/sdk-node";
   Rewind.init({ agentSlug: "my-agent", owner: "team", apiUrl: process.env.REWIND_API_URL });
   ```

2. **Open a run** for each agent invocation:
   ```ts
   const run = await Rewind.startRun("job-42");
   ```

3. **Auto-instrument the model and tools** — no manual `emit` needed for these:
   ```ts
   run.wrapLLM(bedrockClient);       // every LLM call -> llm_call event (with token usage)
   const tools = run.wrapTools(rawTools); // each call -> tool_call + tool_result events
   ```

4. **Emit memory operations explicitly** — these are what forks edit and what
   `find_similar_failures` searches, so record them faithfully:
   ```ts
   run.emit("memory_write", { key: "customer:1234", value: record });
   run.emit("memory_read",  { key: "customer:1234", value: record });
   ```

5. **End the run** so buffered events flush:
   ```ts
   await run.end();
   ```

## Rules

- Use the seven event kinds only: `llm_call`, `tool_call`, `tool_result`, `memory_read`, `memory_write`, `observation`, `ccloud_action`.
- Keep `memory_write` payloads shaped `{ key, value }` — forks and self-correction depend on it.
- Never block the agent on Rewind: the SDK batches and retries, and buffers to disk if the API is down.
- Give each run a stable, human-readable label; it's how you find it later.
