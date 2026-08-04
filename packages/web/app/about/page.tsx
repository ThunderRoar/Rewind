import Link from "next/link";

export const metadata = { title: "How Rewind works" };

export default function About() {
  return (
    <main className="container">
      <div className="crumb">
        <Link href="/">Rewind</Link>
        <span style={{ color: "var(--faint)" }}>/</span>
        <span>How it works</span>
      </div>
      <div className="doc">
        <h1>How Rewind works</h1>
        <p className="lede" style={{ marginTop: 8 }}>
          Rewind treats an agent&apos;s cognition like a git repository. Every decision is a commit;
          every alternative is a branch.
        </p>

        <h2>1 · Record</h2>
        <p>
          A tiny SDK wraps the agent. Each LLM call, tool call, memory read/write, and observation is
          emitted as an append-only, content-addressed event and stored in CockroachDB. Nothing is
          ever mutated — that&apos;s what makes time-travel real. Identical payloads share a hash, so
          a fork can reuse unchanged rows instead of copying them.
        </p>

        <h2>2 · Scrub &amp; search</h2>
        <p>
          The timeline reconstructs the agent&apos;s state at any point — which memories existed, what
          it had seen. Every event is embedded into a distributed vector index, so you can
          semantically search across hundreds of thousands of events (&ldquo;every time it tried to refund over
          $500&rdquo;) and jump straight to the moment.
        </p>

        <h2>3 · Fork &amp; replay</h2>
        <p>
          Right-click any decision and fork it: edit the memory the agent had, then replay. The agent
          program re-runs forward from that point through Amazon Bedrock. Side-effecting tools are
          routed to a sandbox, so no real money moves.
        </p>

        <h2>4 · Prove it — the control replay</h2>
        <p>
          An LLM replayed with <em>no</em> change still drifts a little, so a raw before/after diff
          proves nothing. Rewind fires <b>two</b> replays per fork: a <b>control</b> (original memory)
          and the <b>edited</b> one, both at temperature 0. If the control reproduces the original
          outcome, the run is reproducible — and any divergence in the edited replay is{" "}
          <b>provably caused by your edit</b>, not model noise. If the control itself diverges, Rewind
          says so honestly instead of faking certainty.
        </p>

        <h2>The demo villain: poisoned memory</h2>
        <p>
          A refund agent reads a &ldquo;verified&rdquo; ownership record that was corrupted to name the
          wrong customer. Following its rules correctly on a false fact, it refunds{" "}
          <span style={{ color: "var(--bad)", fontWeight: 600 }}>$4,200</span> to the wrong person.
          Rewind rewinds to the poisoned write, fixes it, and replays — the agent now refuses, and the
          control replay proves the fix is what changed the outcome.
        </p>

        <div style={{ marginTop: 28 }}>
          <Link href="/timelines" className="btn btn-primary btn-lg">
            Explore the timelines →
          </Link>
        </div>
      </div>
    </main>
  );
}
