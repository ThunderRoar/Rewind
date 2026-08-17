import Link from "next/link";
import { ProductMock } from "./ProductMock";
import { RewindDemo } from "./RewindDemo";
import { API_URL } from "@/lib/api";

export const metadata = {
  title: "Rewind - Time travel debugging for AI agents",
};

function Feature({ color, title, body, path }: { color: string; title: string; body: string; path: string }) {
  return (
    <div className="feature">
      <div className="ic">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d={path} stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

async function liveIndexSize(): Promise<number | undefined> {
  try {
    const key = process.env.NEXT_PUBLIC_REWIND_API_KEY;
    const res = await fetch(`${API_URL}/stats`, {
      headers: key ? { "x-api-key": key } : {},
      next: { revalidate: 300 },
    });
    if (!res.ok) return undefined;
    return ((await res.json()) as { index_size?: number }).index_size;
  } catch {
    return undefined;
  }
}

export default async function Landing() {
  const indexSize = await liveIndexSize();
  return (
    <main className="container wide">
      <section className="hero">
        <div className="eyebrow" style={{ marginBottom: 18 }}>CockroachDB × AWS · agentic memory</div>
        <h1>
          Rewind any decision <span className="accent-word">your agent</span> ever made.
        </h1>
        <p>
          Every tool call, memory read, and LLM response an agent makes is a durable, forkable row.
          Scrub the timeline, fork a moment, edit the memory the agent had, and replay it. A control
          run alongside proves the new outcome came from your edit, not the model&apos;s randomness.
        </p>
        <div className="cta-row">
          <Link href="/timelines" className="btn btn-primary btn-lg">
            Explore the timelines →
          </Link>
          <Link href="/about" className="btn btn-lg">
            How it works
          </Link>
        </div>
        <div className="hero-visual">
          <ProductMock indexSize={indexSize} />
        </div>
      </section>

      <RewindDemo />

      <section className="story">
        <div>
          <h2>An agent&apos;s memory got poisoned. It paid out the wrong customer.</h2>
          <p>
            A refund agent reads a &ldquo;verified&rdquo; ownership record that was quietly
            corrupted. Its checks pass on the poisoned fact, and it refunds{" "}
            <span className="num">$4,200</span> to the wrong person. The logs show <em>what</em>{" "}
            happened — not what it <em>would have</em> done if the memory were clean.
          </p>
          <p>
            Rewind is the black-box recorder and the fix-and-verify loop: rewind to the poisoned
            write, correct it, and replay both the original and a control to prove the fix — not luck
            — is what changed the outcome.
          </p>
        </div>
        <div className="card inset" style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>What the fork edits</div>
          <div className="rec">
            <div className="rec-head">
              <span className="dot" style={{ background: "var(--k-memory_write)" }} />
              memory_write · <span style={{ color: "var(--text)" }}>order:A-9:owner</span>
            </div>
            <div className="rec-line rec-del">
              <span className="mark">-</span>
              <span>owner: customer 1002 (Jane) — poisoned</span>
            </div>
            <div className="rec-line rec-add">
              <span className="mark">+</span>
              <span>owner: customer 1001 (John) — verified</span>
            </div>
          </div>
          <p style={{ color: "var(--dim)", fontSize: 13, margin: "12px 0 0" }}>
            One row. Rewind restores the true owner, replays, and the agent refuses the wrong refund.
          </p>
        </div>
      </section>

      <section className="features">
        <div className="eyebrow">What&apos;s inside</div>
        <h2 style={{ fontSize: 26, letterSpacing: "-0.02em", marginTop: 6 }}>
          A production memory layer you can branch
        </h2>
        <div className="feature-grid">
          <Feature
            color="var(--lane-0)"
            title="Branchable timeline"
            body="Append-only, content-addressed events in CockroachDB. Forks share unchanged rows — real git semantics for cognition."
            path="M5 4v8a3 3 0 003 3h4m3-11a2 2 0 100-4 2 2 0 000 4zM5 4a2 2 0 100-.01M5 15a2 2 0 100 .01"
          />
          <Feature
            color="var(--lane-2)"
            title="Attributable replay"
            body="Every fork runs a control + edited replay at temperature 0. If the control reproduces the original, the diff is provably caused by your edit."
            path="M4 10a6 6 0 016-6m0 0V1m0 3l2 2M16 10a6 6 0 01-6 6m0 0v3m0-3l-2-2"
          />
          <Feature
            color="var(--lane-1)"
            title="Semantic search"
            body="A distributed vector index over nearly a million events. Ask “every time it tried to refund over $500” and jump straight there."
            path="M9 9m-5 0a5 5 0 1010 0 5 5 0 10-10 0M13 13l4 4"
          />
          <Feature
            color="var(--k-memory_write)"
            title="Memory-poisoning forensics"
            body="Detect similar past failures mid-run. A live agent recalls its own incidents and self-corrects before it misfires."
            path="M10 2l7 4v5c0 4-3 6.5-7 7-4-.5-7-3-7-7V6l7-4z"
          />
          <Feature
            color="var(--warn)"
            title="Cost & audit built in"
            body="Every replay is priced; every fork, edit, and search is written to an owner-scoped audit log. Observability from day one."
            path="M3 3v14h14M7 13l3-4 3 2 3-5"
          />
          <Feature
            color="var(--lane-5)"
            title="MCP for any agent"
            body="Rewind exposes itself over MCP. Claude Code or Cursor can ask “what did I try last time?” and get its own history back."
            path="M4 12l4-6 3 4 2-3 3 5"
          />
        </div>
      </section>

      <section style={{ padding: "20px 0 48px" }}>
        <div className="card" style={{ padding: 28, display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 22 }}>See it on a real poisoned run.</h2>
            <p style={{ color: "var(--dim)", margin: "6px 0 0" }}>
              Open the timelines, scrub to the poisoned write, and fork it.
            </p>
          </div>
          <Link href="/timelines" className="btn btn-primary btn-lg">
            Explore the timelines →
          </Link>
        </div>
      </section>

      <footer className="site-footer">
        <span>Rewind</span>
        <span style={{ color: "var(--faint)" }}>·</span>
        <span>Apache-2.0</span>
        <span style={{ color: "var(--faint)" }}>·</span>
        <Link href="/about">How it works</Link>
        <span style={{ color: "var(--faint)" }}>·</span>
        <Link href="/mcp">MCP setup</Link>
      </footer>
    </main>
  );
}
