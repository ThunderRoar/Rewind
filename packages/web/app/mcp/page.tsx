import Link from "next/link";

export const metadata = { title: "Rewind MCP server" };

export default function Mcp() {
  return (
    <main className="container">
      <div className="crumb">
        <Link href="/">Rewind</Link>
        <span style={{ color: "var(--faint)" }}>/</span>
        <span>MCP server</span>
      </div>
      <div className="doc">
        <h1>Rewind MCP server</h1>
        <p className="lede" style={{ marginTop: 8 }}>
          Rewind exposes itself over the Model Context Protocol, so any MCP client — Claude Code,
          Cursor, Claude Desktop — can query an agent&apos;s own history.
        </p>

        <h2>Tools it exposes</h2>
        <ul>
          <li>
            <code>search_history(query, limit)</code> — semantic search across an agent&apos;s past
            events.
          </li>
          <li>
            <code>find_similar_failures(context)</code> — &ldquo;have I failed on something like this
            before?&rdquo; over runs a human flagged and forked.
          </li>
          <li>
            <code>get_run(run_id)</code> — the full timeline of a run.
          </li>
        </ul>

        <h2>Add it to Claude Code</h2>
        <p>
          Point the server at your Rewind API with <code>REWIND_API_URL</code>, then add it to{" "}
          <code>.mcp.json</code>:
        </p>
        <pre>{`{
  "mcpServers": {
    "rewind": {
      "command": "npx",
      "args": ["-y", "@rewind/mcp-server"],
      "env": { "REWIND_API_URL": "https://your-api-url" }
    }
  }
}`}</pre>

        <h2>Cursor / VS Code</h2>
        <p>
          Cursor reads <code>.cursor/mcp.json</code>; VS Code reads <code>.vscode/mcp.json</code>{" "}
          (with a <code>servers</code> key instead of <code>mcpServers</code>). The command and env are
          the same.
        </p>

        <h2>Try it</h2>
        <p>
          Once connected, ask your agent:{" "}
          <em>&ldquo;what have my past sessions learned about the refund flow?&rdquo;</em> — it queries
          Rewind and returns a synthesis of past runs.
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
