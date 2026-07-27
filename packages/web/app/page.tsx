import Link from "next/link";
import { getRuns } from "@/lib/api";
import { SearchBar } from "./SearchBar";

export default async function Home() {
  const { runs } = await getRuns();
  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>Rewind</h1>
      <p style={{ color: "#8b93a7", marginTop: 0 }}>
        Time-travel debugging for AI agents - pick a run to scrub its timeline.
      </p>

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
              {r.agent_slug} · {r.event_count} events · {r.status}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
