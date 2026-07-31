"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { searchEvents, type SearchResult } from "@/lib/api";

const KNOWN = new Set([
  "llm_call",
  "tool_call",
  "tool_result",
  "memory_read",
  "memory_write",
  "observation",
  "ccloud_action",
]);
const kindColor = (kind: string) => (KNOWN.has(kind) ? `var(--k-${kind})` : "var(--faint)");

export function SearchBar() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults((await searchEvents(q, 20)).results);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ margin: "18px 0 8px" }}>
      <form onSubmit={run} className="field">
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Semantic search across every event — e.g. “refunds over $500”"
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "…" : "Search"}
        </button>
      </form>

      {error && <div style={{ color: "var(--bad)", marginTop: 8, fontSize: 13 }}>{error}</div>}

      {results && (
        <div style={{ marginTop: 12 }}>
          {results.length === 0 ? (
            <div style={{ color: "var(--faint)" }}>No results.</div>
          ) : (
            results.map((r) => (
              <Link key={r.id} href={`/runs/${r.run_id}?seq=${r.seq}`} className="row-link">
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span className="dot" style={{ background: kindColor(r.kind) }} />
                  <span className="kind" style={{ color: kindColor(r.kind) }}>
                    {r.kind}
                  </span>
                  <span style={{ color: "var(--faint)", fontFamily: "var(--mono)" }}>
                    #{r.seq} · dist {Number(r.distance).toFixed(3)}
                  </span>
                </div>
                <div style={{ color: "var(--dim)", marginTop: 3, fontSize: 13 }}>{r.summary}</div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
