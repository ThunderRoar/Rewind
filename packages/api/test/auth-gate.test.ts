import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { authHook } from "../src/auth.js";

// Exercises the gate through the real Fastify onRequest pipeline. No DB: the
// stub handlers stand in for the routes, so a 200 means "the gate let it past".
function appWith(keys: string) {
  process.env.REWIND_API_KEYS = keys;
  const app = Fastify();
  app.addHook("onRequest", authHook);
  app.get("/health", async () => ({ ok: true }));
  app.get("/runs", async () => ({ ok: true }));
  app.post("/runs", async () => ({ ok: true }));
  app.post("/events", async () => ({ ok: true }));
  app.post("/search", async () => ({ ok: true }));
  app.post("/replay", async () => ({ ok: true }));
  return app;
}

const DEMO = "judge:me::demo";
const ADMIN = "op:me";

test("demo key cannot ingest events", async () => {
  const app = appWith(`${ADMIN},${DEMO}`);
  const res = await app.inject({
    method: "POST",
    url: "/events",
    headers: { "x-api-key": "judge" },
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "forbidden");
});

test("demo key cannot create runs, but can still read them", async () => {
  const app = appWith(`${ADMIN},${DEMO}`);
  const write = await app.inject({
    method: "POST",
    url: "/runs",
    headers: { "x-api-key": "judge" },
  });
  assert.equal(write.statusCode, 403);

  const read = await app.inject({
    method: "GET",
    url: "/runs",
    headers: { "x-api-key": "judge" },
  });
  assert.equal(read.statusCode, 200);
});

test("demo key may search and replay", async () => {
  const app = appWith(`${ADMIN},${DEMO}`);
  for (const url of ["/search", "/replay"]) {
    const res = await app.inject({ method: "POST", url, headers: { "x-api-key": "judge" } });
    assert.equal(res.statusCode, 200, `${url} should be allowed for demo`);
  }
});

test("admin key retains write access", async () => {
  const app = appWith(`${ADMIN},${DEMO}`);
  for (const url of ["/events", "/runs"]) {
    const res = await app.inject({ method: "POST", url, headers: { "x-api-key": "op" } });
    assert.equal(res.statusCode, 200, `${url} should be allowed for admin`);
  }
});

test("health stays open and auth-off leaves writes unscoped", async () => {
  const gated = appWith(`${ADMIN},${DEMO}`);
  assert.equal((await gated.inject({ method: "GET", url: "/health" })).statusCode, 200);

  const open = appWith("");
  const res = await open.inject({ method: "POST", url: "/events" });
  assert.equal(res.statusCode, 200);
});
