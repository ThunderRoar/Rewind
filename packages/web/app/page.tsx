import Link from "next/link";
import { getAudit, getRuns, getStats } from "@/lib/api";
import { SearchBar } from "./SearchBar";

export const dynamic = "force-dynamic";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "10px 14px",
        borderRadius: 8,
        background: "#141925",
        border: "1px solid #232a3a",
      }}
    >
      <div style={{ color: "#8b93a7", fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

export default async function Home() {
  const [{ runs }, stats, { entries }] = await Promise.all([getRuns(), getStats(), getAudit()]);

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>Rewind</h1>
      <p style={{ color: "#8b93a7", marginTop: 0 }}>
        Time-travel debugging for AI agents - pick a run to scrub its timeline.
      </p>

      {/* Observability: system stats */}
      <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
        <StatTile label="runs" value={stats.runs.toLocaleString()} />
        <StatTile label="events indexed" value={stats.events.toLocaleString()} />
        <StatTile label="forks" value={stats.forks} />
        <StatTile label="replays" value={stats.replays} />
        <StatTile label="total replay cost" value={`$${stats.total_cost.toFixed(4)}`} />
      </div>

      <SearchBar />

      <ul style={{ listStyle: "none", padding: 0, marginTop: 24 }}>
        {runs.map((r) => (
          <li
            key={r.id}
            style={{
              padding: "12px 16px",
              marginBottom: 8,
              borderRadius: 8,
              background: "#141925",
              border: "1px solid #232a3a",
            }}
          >
            <Link href={`/runs/${r.id}`} style={{ color: "#7aa2f7", fontWeight: 600 }}>
              {r.label ?? r.id}
            </Link>
            <span style={{ color: "#8b93a7", marginLeft: 10, fontSize: 14 }}>
              {r.agent_slug} · {r.event_count} events · {r.status} ·{" "}
              <code style={{ color: "#5c6370" }}>{r.id.slice(0, 8)}</code> ·{" "}
              {new Date(r.created_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>

      {/* Observability: audit log */}
      {entries.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ color: "#8b93a7", fontSize: 12, marginBottom: 8 }}>
            AUDIT LOG (who did what)
          </div>
          <div style={{ border: "1px solid #232a3a", borderRadius: 8, overflow: "hidden" }}>
            {entries.slice(0, 10).map((e, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "6px 12px",
                  fontSize: 13,
                  fontFamily: "monospace",
                  borderTop: i === 0 ? "none" : "1px solid #1b2230",
                  color: "#c8d3f5",
                }}
              >
                <span style={{ color: "#5c6370", width: 150 }}>
                  {new Date(e.ts).toLocaleString()}
                </span>
                <span style={{ color: "#e0af68", width: 70 }}>{e.action}</span>
                <span style={{ color: "#7aa2f7", width: 90 }}>{e.owner}</span>
                <span style={{ color: "#6b7280" }}>{e.target.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
