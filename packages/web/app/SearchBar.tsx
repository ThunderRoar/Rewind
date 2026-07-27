"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { searchEvents, type SearchResult } from "@/lib/api";

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
      const res = await searchEvents(q, 20);
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #232a3a",
    background: "#0f131c",
    color: "#e6e6e6",
  } as const;

  return (
    <div style={{ marginBottom: 24 }}>
      <form onSubmit={run} style={{ display: "flex", gap: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Semantic search across every event…"
          style={inputStyle}
        />
        <button
          type="submit"
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #232a3a",
            background: "#1b2333",
            color: "#7aa2f7",
            cursor: "pointer",
          }}
        >
          {loading ? "…" : "Search"}
        </button>
      </form>

      {error && (
        <div style={{ color: "#f7768e", marginTop: 8, fontSize: 13 }}>{error}</div>
      )}

      {results && (
        <div style={{ marginTop: 12 }}>
          {results.length === 0 ? (
            <div style={{ color: "#5c6370" }}>No results.</div>
          ) : (
            results.map((r) => (
              <Link
                key={r.id}
                href={`/runs/${r.run_id}?seq=${r.seq}`}
                style={{
                  display: "block",
                  padding: "8px 12px",
                  marginBottom: 6,
                  borderRadius: 8,
                  background: "#141925",
                  border: "1px solid #232a3a",
                  color: "#c8d3f5",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#7aa2f7", fontWeight: 600 }}>{r.kind}</span> · #
                {r.seq} · dist {Number(r.distance).toFixed(3)}
                <div style={{ color: "#8b93a7", marginTop: 2 }}>{r.summary}</div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
