import { test } from "node:test";
import assert from "node:assert/strict";
import { authEnabled, principalForKey } from "../src/auth.js";

test("auth is OFF when REWIND_API_KEYS is empty", () => {
  process.env.REWIND_API_KEYS = "";
  assert.equal(authEnabled(), false);
});

test("auth is ON when keys are configured", () => {
  process.env.REWIND_API_KEYS = "k1:acme,k2:globex";
  assert.equal(authEnabled(), true);
});

test("an org-only key is a company admin (no agent scope)", () => {
  process.env.REWIND_API_KEYS = "admin-key:acme";
  assert.deepEqual(principalForKey("admin-key"), { org: "acme" });
});

test("a key:org:agent is a member scoped to one sub-agent", () => {
  process.env.REWIND_API_KEYS = "member-key:acme:acme-refund-agent";
  assert.deepEqual(principalForKey("member-key"), { org: "acme", agent: "acme-refund-agent" });
});

test("unknown and missing keys resolve to null", () => {
  process.env.REWIND_API_KEYS = "k1:acme";
  assert.equal(principalForKey("nope"), null);
  assert.equal(principalForKey(undefined), null);
});

test("a bare key with no org is ignored (org is required)", () => {
  process.env.REWIND_API_KEYS = "loosekey";
  assert.equal(principalForKey("loosekey"), null);
});
