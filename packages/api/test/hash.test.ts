import { test } from "node:test";
import assert from "node:assert/strict";
import { payloadSha } from "../src/hash.js";

test("payloadSha is stable regardless of key order (content-addressing)", () => {
  assert.equal(payloadSha({ b: 2, a: 1 }), payloadSha({ a: 1, b: 2 }));
});

test("payloadSha differs when content differs", () => {
  assert.notEqual(payloadSha({ a: 1 }), payloadSha({ a: 2 }));
});

test("payloadSha returns a 64-char hex sha256", () => {
  assert.match(payloadSha({ x: 1, y: [1, 2, 3] }), /^[0-9a-f]{64}$/);
});
