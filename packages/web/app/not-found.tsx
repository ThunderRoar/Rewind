import Link from "next/link";

export const metadata = { title: "Not found — Rewind" };

export default function NotFound() {
  return (
    <main className="container">
      <div className="notfound">
        <div>
          <svg width="40" height="40" viewBox="0 0 18 18" fill="none" aria-hidden style={{ margin: "0 auto 6px", display: "block" }}>
            <circle cx="4.5" cy="4" r="2.2" stroke="var(--accent)" strokeWidth="1.4" />
            <circle cx="4.5" cy="14" r="2.2" stroke="var(--accent)" strokeWidth="1.4" />
            <circle cx="13.5" cy="9" r="2.2" stroke="var(--k-memory_write)" strokeWidth="1.4" />
            <path d="M4.5 6.2v5.6M4.5 9h4.2c1.6 0 2.2-.8 3-1.6" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <div className="code">404 · branch not found</div>
          <h1>This timeline doesn&apos;t exist</h1>
          <p>The run or page you followed was never recorded — or the fork was pruned.</p>
          <div className="actions">
            <Link href="/timelines" className="btn btn-primary">Explore the timelines →</Link>
            <Link href="/" className="btn">Home</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
