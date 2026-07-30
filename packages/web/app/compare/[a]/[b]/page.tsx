import Link from "next/link";
import { getRun, type RewindEvent } from "@/lib/api";

export const dynamic = "force-dynamic";

const KIND_COLORS: Record<string, string> = {
  llm_call: "#7aa2f7",
  tool_call: "#e0af68",
  tool_result: "#9ece6a",
  memory_read: "#bb9af7",
  memory_write: "#f7768e",
  observation: "#7dcfff",
  ccloud_action: "#ff9e64",
};

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
  if (!e) return <div style={{ color: "#3b4252" }}>—</div>;
  return (
    <div>
      <span style={{ color: "#5c6370" }}>#{e.seq} </span>
      <span style={{ color: KIND_COLORS[e.kind] ?? "#e6e6e6", fontWeight: 600 }}>{e.kind}</span>
      <div style={{ color: "#6b7280", fontFamily: "monospace", fontSize: 12, marginTop: 2 }}>
        {preview(e.payload)}
      </div>
    </div>
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

  const [left, right, ctrl] = await Promise.all([
    getRun(a),
    getRun(b),
    control ? getRun(control) : Promise.resolve(null),
  ]);

  const origRefund = issuedRefund(left.events);
  const editRefund = issuedRefund(right.events);
  const ctrlRefund = ctrl ? issuedRefund(ctrl.events) : null;
  const reproducible = ctrl ? ctrlRefund === origRefund : null;

  const maxLen = Math.max(left.events.length, right.events.length);

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <Link href="/" style={{ color: "#7aa2f7", fontSize: 14 }}>
        ← runs
      </Link>
      <h1 style={{ marginBottom: 12 }}>Replay diff</h1>

      {/* Attribution banner */}
      {reproducible === true && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "#132018",
            border: "1px solid #9ece6a55",
            color: "#9ece6a",
            marginBottom: 16,
          }}
        >
          ✅ <b>Control replay reproduced the original outcome</b> (refund{" "}
          {origRefund ? "issued" : "refused"}) → the edited replay&apos;s different outcome is{" "}
          <b>caused by your memory edit</b>, not model noise.
        </div>
      )}
      {reproducible === false && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "#20190f",
            border: "1px solid #e0af6855",
            color: "#e0af68",
            marginBottom: 16,
          }}
        >
          ⚠️ Control replay diverged from the original — this run has some inherent nondeterminism,
          so the diff below is suggestive rather than proven.
        </div>
      )}

      {/* Outcome summary */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #232a3a", background: "#0f131c" }}>
          <div style={{ color: "#8b93a7", fontSize: 12 }}>ORIGINAL ({left.run.label})</div>
          <div style={{ color: origRefund ? "#f7768e" : "#9ece6a", fontWeight: 600 }}>
            {origRefund ? "❌ refund issued ($4,200 to wrong customer)" : "✅ refund refused"}
          </div>
        </div>
        <div style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #232a3a", background: "#0f131c" }}>
          <div style={{ color: "#8b93a7", fontSize: 12 }}>EDITED ({right.run.label})</div>
          <div style={{ color: editRefund ? "#f7768e" : "#9ece6a", fontWeight: 600 }}>
            {editRefund ? "❌ refund issued" : "✅ refund refused"}
          </div>
        </div>
      </div>

      {costUsd != null && origRefund && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            background: "#0f131c",
            border: "1px solid #232a3a",
            marginBottom: 16,
            color: "#c8d3f5",
          }}
        >
          💸 This investigation cost <b>${costUsd.toFixed(4)}</b> and caught a{" "}
          <b style={{ color: "#f7768e" }}>$4,200</b> wrong payout.
        </div>
      )}

      <div style={{ color: "#8b93a7", fontSize: 12, marginBottom: 8 }}>
        Rows <span style={{ background: "#1a1420", padding: "1px 6px", borderRadius: 4 }}>highlighted</span>{" "}
        where the two runs differ. Bold labels color the event kind.
      </div>

      {/* Side-by-side timelines aligned by seq */}
      <div style={{ border: "1px solid #232a3a", borderRadius: 8, overflow: "hidden" }}>
        {Array.from({ length: maxLen }, (_, i) => {
          const l = left.events[i];
          const r = right.events[i];
          const diverged = sig(l) !== sig(r);
          return (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                padding: "8px 12px",
                background: diverged ? "#1a1420" : "transparent",
                borderTop: i === 0 ? "none" : "1px solid #1b2230",
              }}
            >
              <Cell e={l} />
              <Cell e={r} />
            </div>
          );
        })}
      </div>
    </main>
  );
}
