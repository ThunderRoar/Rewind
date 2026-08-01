import Link from "next/link";
import { getRun, type RewindEvent } from "@/lib/api";

export const dynamic = "force-dynamic";

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

function issuedRefund(events: RewindEvent[]): boolean {
  return events.some(
    (e) => e.kind === "tool_call" && (e.payload as { tool?: string }).tool === "issue_refund"
  );
}

function preview(payload: unknown): string {
  const s = JSON.stringify(payload);
  return s.length > 90 ? s.slice(0, 90) + "…" : s;
}

// Content signature for divergence so identical decisions don't falsely read as divergent.
function sig(e: RewindEvent | undefined): string {
  if (!e) return "∅";
  const p = { ...(e.payload as Record<string, unknown>) };
  delete p.latencyMs;
  return `${e.kind}|${JSON.stringify(p)}`;
}

function Cell({ e }: { e: RewindEvent | undefined }) {
  if (!e) return <div className="diff-cell" style={{ color: "var(--faint)" }}>—</div>;
  return (
    <div className="diff-cell">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <span className="dot" style={{ background: kindColor(e.kind) }} />
        <span className="kind" style={{ color: kindColor(e.kind) }}>
          {e.kind}
        </span>
      </span>
      <div className="prev">{preview(e.payload)}</div>
    </div>
  );
}

function ForkDiagram() {
  return (
    <svg width="132" height="46" viewBox="0 0 132 46" fill="none" aria-hidden style={{ flex: "none" }}>
      <line x1="6" y1="23" x2="52" y2="23" stroke="var(--lane-0)" strokeWidth="2" />
      <circle cx="6" cy="23" r="4" fill="var(--lane-0)" />
      <circle cx="52" cy="23" r="5" fill="var(--lane-0)" />
      <path d="M52 23 C 72 23, 80 8, 100 8" stroke="var(--lane-2)" strokeWidth="2" fill="none" />
      <path d="M52 23 C 72 23, 80 38, 100 38" stroke="var(--lane-4)" strokeWidth="2" fill="none" />
      <circle cx="104" cy="8" r="4" fill="var(--lane-2)" />
      <circle cx="104" cy="38" r="4" fill="var(--lane-4)" />
    </svg>
  );
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ a: string; b: string }>;
  searchParams: Promise<{ control?: string; cost?: string }>;
}) {
  const { a, b } = await params;
  const { control, cost } = await searchParams;
  const costUsd = cost ? Number(cost) : null;

  let left, right, ctrl;
  try {
    [left, right, ctrl] = await Promise.all([
      getRun(a),
      getRun(b),
      control ? getRun(control) : Promise.resolve(null),
    ]);
  } catch (e) {
    return (
      <main className="container wide">
        <div className="crumb">
          <Link href="/timelines">Timelines</Link>
        </div>
        <div className="banner banner-warn">
          <span className="rail" />
          <div>Couldn&apos;t load one of the runs to compare (<code>{e instanceof Error ? e.message : String(e)}</code>).</div>
        </div>
      </main>
    );
  }

  const origRefund = issuedRefund(left.events);
  const editRefund = issuedRefund(right.events);
  const ctrlRefund = ctrl ? issuedRefund(ctrl.events) : null;
  const reproducible = ctrl ? ctrlRefund === origRefund : null;
  const maxLen = Math.max(left.events.length, right.events.length);
  const divergedCount = Array.from({ length: maxLen }, (_, i) =>
    sig(left.events[i]) !== sig(right.events[i]) ? 1 : 0
  ).reduce<number>((s, n) => s + n, 0);

  return (
    <main className="container wide">
      <div className="crumb">
        <Link href="/timelines">Timelines</Link>
        <span style={{ color: "var(--faint)" }}>/</span>
        <span>Replay diff</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <ForkDiagram />
        <div>
          <h1>Replay diff</h1>
          <p className="meta-line" style={{ marginTop: 2 }}>
            base <code>{left.run.label}</code> vs fork <code>{right.run.label}</code>
            <span className="sep">·</span>
            {divergedCount} diverging {divergedCount === 1 ? "step" : "steps"}
          </p>
        </div>
      </div>

      {reproducible === true && (
        <div className="banner banner-good">
          <span className="rail" />
          <div>
            <b>Control replay reproduced the original outcome</b> (refund{" "}
            {origRefund ? "issued" : "refused"}). The edited branch&apos;s different outcome is{" "}
            <b>caused by your memory edit</b> — not model noise.
          </div>
        </div>
      )}
      {reproducible === false && (
        <div className="banner banner-warn">
          <span className="rail" />
          <div>
            Control replay diverged from the original — this run has inherent nondeterminism, so the
            diff below is suggestive rather than proven.
          </div>
        </div>
      )}

      <div className="outcome-grid">
        <div className="outcome">
          <div className="label">
            <span className="dot" style={{ background: "var(--lane-0)" }} /> original ·{" "}
            <code>{left.run.label}</code>
          </div>
          <div className={`verdict ${origRefund ? "bad" : "good"}`}>
            <span className="dot" style={{ background: origRefund ? "var(--bad)" : "var(--good)" }} />
            {origRefund ? "refund issued — $4,200 to wrong customer" : "refund refused"}
          </div>
        </div>
        <div className="outcome">
          <div className="label">
            <span className="dot" style={{ background: "var(--lane-4)" }} /> edited ·{" "}
            <code>{right.run.label}</code>
          </div>
          <div className={`verdict ${editRefund ? "bad" : "good"}`}>
            <span className="dot" style={{ background: editRefund ? "var(--bad)" : "var(--good)" }} />
            {editRefund ? "refund issued" : "refund refused"}
          </div>
        </div>
      </div>

      {costUsd != null && origRefund && (
        <div className="callout">
          This investigation cost <b style={{ fontFamily: "var(--mono)" }}>${costUsd.toFixed(4)}</b>{" "}
          and caught a <b style={{ color: "var(--bad)" }}>$4,200</b> wrong payout.
        </div>
      )}

      <p className="hint">
        Rows where the two branches differ are highlighted; identical rows share the same
        content hash.
      </p>

      <div className="diff">
        <div className="diff-head">
          <span>seq</span>
          <span>original</span>
          <span>edited</span>
        </div>
        {Array.from({ length: maxLen }, (_, i) => {
          const l = left.events[i];
          const r = right.events[i];
          const diverged = sig(l) !== sig(r);
          return (
            <div key={i} className={`diff-row${diverged ? " diverged" : ""}`}>
              <span className="gutter">
                #{l?.seq ?? r?.seq ?? i}
                {diverged && <span className="badge badge-diff">diff</span>}
              </span>
              <Cell e={l} />
              <Cell e={r} />
            </div>
          );
        })}
      </div>
    </main>
  );
}
