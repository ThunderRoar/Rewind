import Link from "next/link";
import { getRun } from "@/lib/api";
import { Timeline } from "./Timeline";

export default async function RunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ seq?: string }>;
}) {
  const { id } = await params;
  const { seq } = await searchParams;
  const { run, events } = await getRun(id);
  const initialSeq = seq != null ? Number(seq) : undefined;

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <Link href="/" style={{ color: "#7aa2f7", fontSize: 14 }}>
        ← runs
      </Link>
      <h1 style={{ marginBottom: 2 }}>{run.label ?? run.id}</h1>
      <p style={{ color: "#8b93a7", marginTop: 0 }}>
        {run.agent_slug} · {run.status} · {run.region} · {events.length} events
      </p>
      <Timeline events={events} initialSeq={initialSeq} />
    </main>
  );
}
