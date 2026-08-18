import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { replayRoutes } from "../src/routes/replay.js";
import { searchRoutes } from "../src/routes/search.js";

// These bounds are a cost control, not cosmetics: every one of these fields either
// enters a Bedrock prompt or is embedded, and the replay spend cap is enforced
// pre-flight, so an unbounded field can overshoot the budget in a single request.
// Validation runs before any DB or Bedrock work, so these tests need neither. The
// all-zeros runId below is also deliberate: even with DATABASE_URL present, the
// isolation gate in forkAndReplay rejects an unknown run before a single Bedrock
// call, so this suite can never incur spend.

async function app(register: (a: ReturnType<typeof Fastify>) => Promise<void>) {
  const a = Fastify();
  await register(a);
  return a;
}

test("oversized editedValue is rejected before any Bedrock call", async () => {
  const a = await app(replayRoutes);
  const res = await a.inject({
    method: "POST",
    url: "/replay",
    payload: {
      runId: "00000000-0000-0000-0000-000000000000",
      editedValue: "x".repeat(2001),
    },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "invalid_body");
});

test("an in-range editedValue passes validation", async () => {
  const a = await app(replayRoutes);
  const res = await a.inject({
    method: "POST",
    url: "/replay",
    payload: {
      runId: "00000000-0000-0000-0000-000000000000",
      editedValue: "x".repeat(2000),
    },
  });
  assert.notEqual(res.statusCode, 400, "2000 chars should be within the bound");
});

test("oversized search query is rejected", async () => {
  const a = await app(searchRoutes);
  const res = await a.inject({
    method: "POST",
    url: "/search",
    payload: { query: "x".repeat(2001) },
  });
  assert.equal(res.statusCode, 400);
});

test("oversized similar-failures context is rejected", async () => {
  const a = await app(searchRoutes);
  const res = await a.inject({
    method: "POST",
    url: "/similar-failures",
    payload: { context: "x".repeat(8001) },
  });
  assert.equal(res.statusCode, 400);
});
