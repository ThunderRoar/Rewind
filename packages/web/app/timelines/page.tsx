import Link from "next/link";
import { getAudit, getRuns, getStats, type RunSummary } from "@/lib/api";
import { SearchBar } from "../SearchBar";

export const dynamic = "force-dynamic";

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`stat${accent ? " accent" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Order runs so each root is immediately followed by its forks (a lineage block).
function lineages(runs: RunSummary[]): { run: RunSummary; isChild: boolean; laneIdx: number }[] {
  const byParent = new Map<string, RunSummary[]>();
  const roots: RunSummary[] = [];
  const ids = new Set(runs.map((r) => r.id));
  for (const r of runs) {
    if (r.parent_run && ids.has(r.parent_run)) {
      const arr = byParent.get(r.parent_run) ?? [];
      arr.push(r);
      byParent.set(r.parent_run, arr);
    } else {
      roots.push(r);
    }
  }
  const out: { run: RunSummary; isChild: boolean; laneIdx: number }[] = [];
  for (const root of roots) {
    out.push({ run: root, isChild: false, laneIdx: 0 });
    (byParent.get(root.id) ?? []).forEach((k, i) =>
      out.push({ run: k, isChild: true, laneIdx: 2 + (i % 4) })
    );
  }
  return out;
}

function Gutter({
  isChild,
  laneIdx,
  isFirst,
  isLast,
}: {
  isChild: boolean;
  laneIdx: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const lane = `var(--lane-${laneIdx})`;
  return (
    <div className="branch-graphic">
      <svg viewBox="0 0 40 100" preserveAspectRatio="none" aria-hidden>
        <line
          x1="14"
          y1={isFirst ? "50" : "0"}
          x2="14"
          y2={isLast ? "50" : "100"}
          stroke="var(--lane-0)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {isChild && (
          <path
            d="M14 0 L14 26 Q14 50 25 50 L30 50"
            fill="none"
            stroke={lane}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <span className="node" style={{ left: isChild ? 30 : 14, background: isChild ? lane : "var(--lane-0)" }} />
    </div>
  );
}

export default async function Timelines() {
  let runs: RunSummary[] = [];
  let entries: Awaited<ReturnType<typeof getAudit>>["entries"] = [];
  let stats = { runs: 0, events: 0, index_size: 0, forks: 0, replays: 0, total_cost: 0 };
  let apiError: string | null = null;
  try {
    const [r, s, a] = await Promise.all([getRuns(), getStats(), getAudit()]);
    runs = r.runs;
    stats = s;
    entries = a.entries;
  } catch (e) {
    apiError = e instanceof Error ? e.message : String(e);
  }
  const ordered = lineages(runs);

  return (
    <main className="container wide">
      <div className="crumb">
        <Link href="/">Rewind</Link>
        <span style={{ color: "var(--faint)" }}>/</span>
        <span>Timelines</span>
      </div>
      {apiError && (
        <div className="banner banner-warn" style={{ marginTop: 12 }}>
          <span className="rail" />
          <div>
            Couldn&apos;t reach the API (<code>{apiError}</code>). Check{" "}
            <code>NEXT_PUBLIC_API_URL</code>
            {" "}and <code>NEXT_PUBLIC_REWIND_API_KEY</code> on Vercel.
          </div>
        </div>
      )}
      <h1>Every agent decision, forkable</h1>
      <p className="lede">
        Each run is a branch of agent cognition. Scrub any timeline, fork a decision, edit the
        memory it had, and replay — with proof the edit changed the outcome.
      </p>

      <div className="stat-grid">
        <Stat label="runs" value={Number(stats.runs).toLocaleString()} />
        <Stat label="events" value={Number(stats.events).toLocaleString()} />
        <Stat label="forks" value={stats.forks} />
        <Stat label="replays" value={stats.replays} />
        <Stat label="replay cost" value={`$${Number(stats.total_cost).toFixed(4)}`} accent />
      </div>

      <SearchBar />
      <div style={{ color: "var(--faint)", fontSize: 12.5, marginTop: 6 }}>
        Distributed vector index · {Number(stats.index_size).toLocaleString()} events cluster-wide ·
        semantic search across every decision
      </div>

      <div className="section-title">
        <h2>Branches</h2>
        <span className="eyebrow" style={{ letterSpacing: "0.06em" }}>
          {runs.length} runs
        </span>
      </div>

      <div className="branch-tree">
        {ordered.map((node, i) => {
          const r = node.run;
          return (
            <div className={`branch-node${node.isChild ? " child" : ""}`} key={r.id}>
              <Gutter
                isChild={node.isChild}
                laneIdx={node.laneIdx}
                isFirst={i === 0}
                isLast={i === ordered.length - 1}
              />
              <div>
                <Link href={`/runs/${r.id}`} className="title">
                  {r.label ?? r.id}
                </Link>
                <div className="sub">
                  {r.agent_slug} <span style={{ color: "var(--faint)" }}>·</span> {r.event_count}{" "}
                  events <span style={{ color: "var(--faint)" }}>·</span> {ago(r.created_at)}
                </div>
              </div>
              <div className="right" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`ref ${node.isChild ? "fork" : "live"}`}>
                  {node.isChild ? "fork" : "live"}
                </span>
                <span className="hash">{r.id.slice(0, 7)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {entries.length > 0 && (
        <>
          <div className="section-title">
            <h2>Audit log</h2>
            <span className="eyebrow" style={{ letterSpacing: "0.06em" }}>
              who did what
            </span>
          </div>
          <div className="audit">
            {entries.slice(0, 10).map((e, i) => (
              <div className="audit-row" key={i}>
                <span className="ts">{new Date(e.ts).toLocaleString()}</span>
                <span className="act">{e.action}</span>
                <span className="who">{e.owner}</span>
                <span className="tgt">{e.target.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
