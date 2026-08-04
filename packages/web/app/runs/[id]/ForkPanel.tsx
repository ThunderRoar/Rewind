"use client";

import { useState } from "react";
import { replayFork, type ReplayResult } from "@/lib/api";

export function ForkPanel({
  runId,
  memoryValue,
  replayable,
}: {
  runId: string;
  memoryValue: string;
  replayable: boolean;
}) {
  const [value, setValue] = useState(memoryValue);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Non-instrumented agents are recorded + searchable but not re-executable — say so, don't offer a failing button.
  if (!replayable) {
    return (
      <div className="fork">
        <div className="cap">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden>
            <circle cx="4.5" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="4.5" cy="14" r="2.2" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="13.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M4.5 6.2v5.6M4.5 9h4.2c1.6 0 2.2-.8 3-1.6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          Fork &amp; replay
        </div>
        <p style={{ color: "var(--dim)", fontSize: 13, margin: "2px 0 0", lineHeight: 1.5 }}>
          This run is fully <b>recorded, scrubbable, and searchable</b> via the SDK. Live replay
          re-executes the agent&apos;s own program loop, which Rewind ships for its instrumented
          agents — try it on a <b>refund-agent</b> run to see fork → replay → diff.
        </p>
      </div>
    );
  }

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
    <div className="fork">
      <div className="cap">
        <svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden>
          <circle cx="4.5" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="4.5" cy="14" r="2.2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="13.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M4.5 6.2v5.6M4.5 9h4.2c1.6 0 2.2-.8 3-1.6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        Fork &amp; fix this memory
      </div>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} />
      <button className="btn btn-primary" onClick={replay} disabled={loading} style={{ marginTop: 9 }}>
        {loading ? "Replaying through Bedrock… (~30s)" : "Fork & Replay"}
      </button>

      {error && <div style={{ color: "var(--bad)", marginTop: 9, fontSize: 13 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <div style={{ color: "var(--good)", display: "flex", alignItems: "center", gap: 7 }}>
            <span className="dot" style={{ background: "var(--good)" }} />
            Replayed — control + edited branches created · investigation cost{" "}
            <b>${result.costUsd.toFixed(4)}</b>
          </div>
          <a
            href={`/compare/${result.originalRunId}/${result.editedRunId}?control=${result.controlRunId}&cost=${result.costUsd}`}
            style={{ display: "block", marginTop: 8, fontWeight: 600 }}
          >
            → View side-by-side diff
          </a>
        </div>
      )}
    </div>
  );
}
