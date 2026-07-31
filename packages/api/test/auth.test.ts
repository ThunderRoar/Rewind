import { test } from "node:test";
import assert from "node:assert/strict";
import { authEnabled, ownerForKey } from "../src/auth.js";

test("auth is OFF when REWIND_API_KEYS is empty", () => {
  process.env.REWIND_API_KEYS = "";
  assert.equal(authEnabled(), false);
});

test("auth is ON when keys are configured", () => {
  process.env.REWIND_API_KEYS = "k1:me,k2:teamx";
  assert.equal(authEnabled(), true);
});

test("ownerForKey resolves a key to its owner", () => {
  process.env.REWIND_API_KEYS = "k1:me, k2:teamx";
  assert.equal(ownerForKey("k1"), "me");
  assert.equal(ownerForKey("k2"), "teamx");
});

test("ownerForKey rejects unknown and missing keys", () => {
  process.env.REWIND_API_KEYS = "k1:me";
  assert.equal(ownerForKey("nope"), null);
  assert.equal(ownerForKey(undefined), null);
});

test("a key with no explicit owner defaults its owner to the key", () => {
  process.env.REWIND_API_KEYS = "solokey";
  assert.equal(ownerForKey("solokey"), "solokey");
});
