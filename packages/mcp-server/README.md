# @rewind/mcp-server

Rewind exposed as a **Model Context Protocol** server, so any MCP-capable agent can query an agent's own history — search past events, find similar past failures, and pull a full run timeline. It's a standard stdio MCP process, so it works with **any** MCP client (Claude Code, Cursor, Claude Desktop, VS Code, Windsurf, or a custom agent) — nothing here is tied to one tool.

## Tools

| Tool | What it does |
|---|---|
| `search_history` | Semantic search across an agent's past events (decisions, tool calls, memories). |
| `find_similar_failures` | Given the current context, return past runs that were flagged and corrected as failures — so the agent can avoid repeating them. |
| `get_run` | Fetch the full event timeline of a run by id. |

Each tool proxies the Rewind REST API, so the server just needs to reach an API instance via `REWIND_API_URL` (default `http://localhost:3000`).

## Build

```bash
pnpm --filter @rewind/mcp-server build      # -> dist/index.js
```

## Add it to your client

Every client uses the same server entry — `command` + `args` + `env` — just in a different file. Point `REWIND_API_URL` at your local API (`http://localhost:3000`) or your deployed Function URL.

**Local build (path-based):**
```json
{
  "command": "node",
  "args": ["/absolute/path/to/rewind/packages/mcp-server/dist/index.js"],
  "env": { "REWIND_API_URL": "http://localhost:3000" }
}
```

**Published (path-free, once on npm):**
```json
{
  "command": "npx",
  "args": ["-y", "@rewind/mcp"],
  "env": { "REWIND_API_URL": "https://your-api-url" }
}
```

Where that snippet goes, per client:

| Client | File | Wrap the snippet under |
|---|---|---|
| **Claude Code** | `.mcp.json` (project root) or `~/.claude.json` | `"mcpServers": { "rewind": { … } }` |
| **Cursor** | `.cursor/mcp.json` | `"mcpServers": { "rewind": { … } }` |
| **Claude Desktop** | `claude_desktop_config.json` (app support dir) | `"mcpServers": { "rewind": { … } }` |
| **VS Code (Copilot)** | `.vscode/mcp.json` | `"servers": { "rewind": { … } }` |

This repo ships a ready `.mcp.json` at the root for Claude Code. Reload MCP servers after adding it, then ask your agent e.g. *"use `find_similar_failures` with context: 'refund to the wrong customer for an order'."*

## Notes

- **stdio protocol:** the server speaks MCP over stdout; all logging goes to **stderr** (never stdout).
- **Requires a running API:** start it with `pnpm dev:api` (local) or deploy per [`DEPLOY.md`](../../DEPLOY.md).
- Publishing to npm as `@rewind/mcp` makes the config path-free (`npx -y @rewind/mcp`) — the most portable option.
