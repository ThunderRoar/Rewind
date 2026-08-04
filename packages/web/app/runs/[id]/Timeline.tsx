"use client";

import { useMemo, useState } from "react";
import type { RewindEvent } from "@/lib/api";
import { ForkPanel } from "./ForkPanel";

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

function preview(payload: unknown): string {
  const s = JSON.stringify(payload);
  return s.length > 64 ? s.slice(0, 64) + "…" : s;
}

export function Timeline({
  events,
  initialSeq,
  runId,
  replayable,
}: {
  events: RewindEvent[];
  initialSeq?: number;
  runId: string;
  replayable: boolean;
}) {
  const initialIdx =
    initialSeq != null
      ? Math.max(
          events.findIndex((e) => e.seq === initialSeq),
          0
        )
      : events.length - 1;
  const [headIdx, setHeadIdx] = useState(initialIdx);
  const selected = events[headIdx] ?? null;

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
      <div style={{ margin: "16px 0 6px" }}>
        <input
          type="range"
          className="scrubber"
          min={0}
          max={Math.max(events.length - 1, 0)}
          value={headIdx}
          onChange={(e) => setHeadIdx(Number(e.target.value))}
        />
        <div style={{ color: "var(--dim)", fontSize: 13, marginTop: 6 }}>
          state as of event <b style={{ color: "var(--text)" }}>{headIdx + 1}</b> / {events.length}
        </div>
      </div>

      <div className="memories">
        <div className="cap">Memories at this point · {memories.length}</div>
        {memories.length === 0 ? (
          <span style={{ color: "var(--faint)", fontSize: 13 }}>none yet</span>
        ) : (
          <div className="chips">
            {memories.map(([k, v]) => (
              <span className="chip" key={k}>
                <b className="k">{k}</b> = {preview(v)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="tl-split">
        <div className="tl-left">
          <div className="graph">
            {events.map((e, i) => {
              const active = i === headIdx;
              const future = i > headIdx;
              const isFirst = i === 0;
              const isLast = i === events.length - 1;
              return (
                <div
                  key={e.id}
                  className={`graph-row${active ? " active" : ""}${future ? " future" : ""}`}
                  onClick={() => setHeadIdx(i)}
                >
                  <div className="graph-gutter">
                    <svg viewBox="0 0 46 100" preserveAspectRatio="none" aria-hidden>
                      <line
                        x1="16"
                        y1={isFirst ? "50" : "0"}
                        x2="16"
                        y2={isLast ? "50" : "100"}
                        stroke="var(--border-hi)"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    <span
                      className="lane-node"
                      style={{
                        position: "absolute",
                        left: 16,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: active ? 13 : 10,
                        height: active ? 13 : 10,
                        borderRadius: "50%",
                        background: kindColor(e.kind),
                        boxShadow: active
                          ? `0 0 0 3px color-mix(in srgb, ${kindColor(e.kind)} 30%, transparent), 0 0 0 5px var(--surface)`
                          : "0 0 0 3px var(--surface)",
                      }}
                    />
                  </div>
                  <div className="body">
                    <div className="head">
                      <span className="seq">#{e.seq}</span>
                      <span className="kind" style={{ color: kindColor(e.kind) }}>
                        {e.kind}
                      </span>
                    </div>
                    <div className="prev">{preview(e.payload)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="detail-pane">
          {selected ? (
            <>
              <div className="dhead">
                <span className="dot" style={{ background: kindColor(selected.kind) }} />
                <span className="kind" style={{ color: kindColor(selected.kind) }}>
                  {selected.kind}
                </span>
                <span>· #{selected.seq}</span>
                <span>· {new Date(selected.ts).toLocaleString()}</span>
                <span>· sha {selected.payload_sha.slice(0, 12)}</span>
              </div>
              <pre>{JSON.stringify(selected.payload, null, 2)}</pre>
              {selected.kind === "memory_write" && (
                <ForkPanel
                  runId={runId}
                  memoryValue={String((selected.payload as { value?: unknown }).value ?? "")}
                  replayable={replayable}
                />
              )}
            </>
          ) : (
            <span style={{ color: "var(--faint)" }}>No events.</span>
          )}
        </div>
      </div>
    </div>
  );
}
