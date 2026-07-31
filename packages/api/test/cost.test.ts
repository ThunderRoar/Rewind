import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCost } from "../src/cost.js";

test("Haiku is priced at $1/1M in + $5/1M out", () => {
  assert.equal(computeCost("global.anthropic.claude-haiku-4-5", 1_000_000, 1_000_000), 6);
});

test("Nova Lite is cheaper than Haiku for the same tokens", () => {
  assert.ok(
    computeCost("amazon.nova-lite-v1:0", 10_000, 10_000) <
      computeCost("haiku", 10_000, 10_000)
  );
});

test("an unknown model falls back to Sonnet rates ($2/1M in)", () => {
  assert.equal(computeCost("some-unknown-model", 1_000_000, 0), 2);
});

test("zero tokens cost nothing", () => {
  assert.equal(computeCost("haiku", 0, 0), 0);
});
