import { createHash } from "node:crypto";

// Deterministic JSON (keys sorted) so identical payloads hash identically.
function canonicalize(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalize).join(",")}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

export function payloadSha(payload: unknown): string {
  return createHash("sha256").update(canonicalize(payload)).digest("hex");
}
