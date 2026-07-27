// Apply db/schema.sql through a real pgwire session. The Cloud SQL console
// can't build vector indexes (it forces the legacy schema changer), so we
// apply via the pg driver with the declarative schema changer enabled.
//
// Run from repo root:  node --env-file=.env packages/api/scripts/apply-schema.mjs
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(here, "../../../db/schema.sql"), "utf8");

const statements = sql
  .replace(/--[^\n]*/g, "")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  // Session-scoped; persists for every statement below.
  await client.query("SET use_declarative_schema_changer = 'unsafe_always'");
  for (const stmt of statements) {
    await client.query(stmt);
  }
  const { rows } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log("✅ Applied db/schema.sql");
  console.log("tables:", rows.map((r) => r.table_name).join(", "));
} catch (err) {
  console.error("❌ Schema apply failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
