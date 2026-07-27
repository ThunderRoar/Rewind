"use client";

import { useMemo, useState } from "react";
import type { RewindEvent } from "@/lib/api";

const KIND_COLORS: Record<string, string> = {
  llm_call: "#7aa2f7",
  tool_call: "#e0af68",
  tool_result: "#9ece6a",
  memory_read: "#bb9af7",
  memory_write: "#f7768e",
  observation: "#7dcfff",
  ccloud_action: "#ff9e64",
};

function preview(payload: unknown): string {
  const s = JSON.stringify(payload);
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}

export function Timeline({
  events,
  initialSeq,
}: {
  events: RewindEvent[];
  initialSeq?: number;
}) {
  const initialIdx =
    initialSeq != null
      ? Math.max(events.findIndex((e) => e.seq === initialSeq), 0)
      : events.length - 1;
  const [headIdx, setHeadIdx] = useState(initialIdx);
  const selected = events[headIdx] ?? null;

  // Memory state as of the scrubber head: fold memory_write events 0..head.
  const memories = useMemo(() => {
    const m = new Map<string, unknown>();
    for (let i = 0; i <= headIdx && i < events.length; i++) {
      const e = events[i];
      if (e.kind === "memory_write") {
        const p = e.payload as { key?: string; value?: unknown };
        if (p?.key) m.set(p.key, p.value);
      }
    }
    return [...m.entries()];
  }, [headIdx, events]);

  return (
    <div>
      {/* Scrubber */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="range"
          min={0}
          max={Math.max(events.length - 1, 0)}
          value={headIdx}
          onChange={(e) => setHeadIdx(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={{ color: "#8b93a7", fontSize: 13 }}>
          state as of event {headIdx + 1} / {events.length}
        </div>
      </div>

      {/* Memory state at the head */}
      <div
        style={{
          marginBottom: 16,
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #232a3a",
          background: "#0f131c",
        }}
      >
        <div style={{ color: "#8b93a7", fontSize: 12, marginBottom: 6 }}>
          MEMORIES AT THIS POINT ({memories.length})
        </div>
        {memories.length === 0 ? (
          <span style={{ color: "#5c6370", fontSize: 13 }}>none yet</span>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {memories.map(([k, v]) => (
              <span
                key={k}
                style={{
                  fontSize: 12,
                  fontFamily: "monospace",
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "#1b2333",
                  border: "1px solid #f7768e55",
                  color: "#c8d3f5",
                }}
              >
                <b style={{ color: "#f7768e" }}>{k}</b> = {preview(v)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 320px)" }}>
        <div
          style={{
            width: 380,
            overflowY: "auto",
            borderRadius: 8,
            border: "1px solid #232a3a",
            background: "#0f131c",
          }}
        >
          {events.map((e, i) => {
            const active = i === headIdx;
            const future = i > headIdx;
            return (
              <button
                key={e.id}
                onClick={() => setHeadIdx(i)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  border: "none",
                  borderLeft: `3px solid ${KIND_COLORS[e.kind] ?? "#5c6370"}`,
                  background: active ? "#1b2333" : "transparent",
                  color: "#e6e6e6",
                  cursor: "pointer",
                  fontSize: 13,
                  opacity: future ? 0.3 : 1,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ color: "#5c6370", width: 44 }}>#{e.seq}</span>
                  <span style={{ color: KIND_COLORS[e.kind] ?? "#e6e6e6", fontWeight: 600 }}>
                    {e.kind}
                  </span>
                </div>
                <div style={{ color: "#6b7280", fontFamily: "monospace", marginTop: 2 }}>
                  {preview(e.payload)}
                </div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            borderRadius: 8,
            border: "1px solid #232a3a",
            background: "#0f131c",
            padding: 16,
          }}
        >
          {selected ? (
            <>
              <div style={{ color: "#8b93a7", fontSize: 13, marginBottom: 12 }}>
                <span style={{ color: KIND_COLORS[selected.kind] ?? "#e6e6e6", fontWeight: 600 }}>
                  {selected.kind}
                </span>{" "}
                · #{selected.seq} · {new Date(selected.ts).toLocaleString()} · sha{" "}
                {selected.payload_sha.slice(0, 12)}
              </div>
              <pre
                style={{
                  margin: 0,
                  fontFamily: "monospace",
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "#c8d3f5",
                }}
              >
                {JSON.stringify(selected.payload, null, 2)}
              </pre>
            </>
          ) : (
            <span style={{ color: "#5c6370" }}>No events.</span>
          )}
        </div>
      </div>
    </div>
  );
}
