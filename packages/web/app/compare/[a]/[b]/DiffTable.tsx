"use client";

import Link from "next/link";
import { useState } from "react";
import type { RewindEvent } from "@/lib/api";
import { sig } from "./sig";

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
  return s.length > 90 ? s.slice(0, 90) + "…" : s;
}

function Cell({ e, open, runId }: { e: RewindEvent | undefined; open: boolean; runId: string }) {
  if (!e) return <div className="diff-cell" style={{ color: "var(--faint)" }}>—</div>;
  return (
    <div className="diff-cell">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <span className="dot" style={{ background: kindColor(e.kind) }} />
        <span className="kind" style={{ color: kindColor(e.kind) }}>{e.kind}</span>
      </span>
      {open ? (
        <>
          <pre className="diff-full">{JSON.stringify(e.payload, null, 2)}</pre>
          <Link
            href={`/runs/${runId}?seq=${e.seq}`}
            className="diff-link"
            onClick={(ev) => ev.stopPropagation()}
          >
            view event #{e.seq} in timeline →
          </Link>
        </>
      ) : (
        <div className="prev">{preview(e.payload)}</div>
      )}
    </div>
  );
}

export function DiffTable({
  left,
  right,
  leftRunId,
  rightRunId,
}: {
  left: RewindEvent[];
  right: RewindEvent[];
  leftRunId: string;
  rightRunId: string;
}) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const maxLen = Math.max(left.length, right.length);
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <div className="diff">
      <div className="diff-head">
        <span>seq</span>
        <span>original</span>
        <span>edited</span>
      </div>
      {Array.from({ length: maxLen }, (_, i) => {
        const l = left[i];
        const r = right[i];
        const diverged = sig(l) !== sig(r);
        const isOpen = open.has(i);
        return (
          <div
            key={i}
            className={`diff-row${diverged ? " diverged" : ""}`}
            onClick={() => toggle(i)}
            style={{ cursor: "pointer" }}
          >
            <span className="gutter">
              #{l?.seq ?? r?.seq ?? i}
              {diverged && <span className="badge badge-diff">diff</span>}
              <span className="diff-caret">{isOpen ? "▾" : "▸"}</span>
            </span>
            <Cell e={l} open={isOpen} runId={leftRunId} />
            <Cell e={r} open={isOpen} runId={rightRunId} />
          </div>
        );
      })}
    </div>
  );
}
