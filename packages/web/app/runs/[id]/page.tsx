import Link from "next/link";
import { getRun } from "@/lib/api";
import { Timeline } from "./Timeline";

export const dynamic = "force-dynamic";

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
    <main className="container wide">
      <div className="crumb">
        <Link href="/timelines">Timelines</Link>
        <span style={{ color: "var(--faint)" }}>/</span>
        <span>{run.label ?? run.id.slice(0, 8)}</span>
      </div>
      <h1>{run.label ?? run.id}</h1>
      <p className="meta-line">
        {run.agent_slug}
        <span className="sep">·</span>
        {run.status}
        <span className="sep">·</span>
        {run.region}
        <span className="sep">·</span>
        {events.length} events
        {run.parent_run && (
          <>
            <span className="sep">·</span>
            branched from{" "}
            <Link href={`/runs/${run.parent_run}`}>{run.parent_run.slice(0, 7)}</Link>
          </>
        )}
      </p>
      <Timeline events={events} initialSeq={initialSeq} runId={run.id} />
    </main>
  );
}
