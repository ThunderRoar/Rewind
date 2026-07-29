"use client";

import { useState } from "react";
import { replayFork, type ReplayResult } from "@/lib/api";

export function ForkPanel({ runId, memoryValue }: { runId: string; memoryValue: string }) {
  const [value, setValue] = useState(memoryValue);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function replay() {
    setLoading(true);
    setError(null);
    try {
      setResult(await replayFork(runId, value));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        padding: 12,
        border: "1px solid #f7768e55",
        borderRadius: 8,
        background: "#1a1420",
      }}
    >
      <div style={{ color: "#f7768e", fontWeight: 600, marginBottom: 8 }}>
        🔱 Fork &amp; fix this memory
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "monospace",
          fontSize: 13,
          background: "#0f131c",
          color: "#c8d3f5",
          border: "1px solid #232a3a",
          borderRadius: 6,
          padding: 8,
        }}
      />
      <button
        onClick={replay}
        disabled={loading}
        style={{
          marginTop: 8,
          padding: "8px 16px",
          borderRadius: 8,
          border: "none",
          background: loading ? "#3a2a30" : "#f7768e",
          color: "#fff",
          cursor: loading ? "default" : "pointer",
          fontWeight: 600,
        }}
      >
        {loading ? "Replaying through Bedrock… (~30s)" : "Fork & Replay"}
      </button>

      {error && <div style={{ color: "#f7768e", marginTop: 8, fontSize: 13 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <div style={{ color: "#9ece6a" }}>
            ✅ Replayed — control + edited runs created.
          </div>
          <a
            href={`/compare/${result.originalRunId}/${result.editedRunId}?control=${result.controlRunId}`}
            style={{ color: "#7aa2f7", display: "block", marginTop: 6, fontWeight: 600 }}
          >
            → View side-by-side diff
          </a>
        </div>
      )}
    </div>
  );
}
