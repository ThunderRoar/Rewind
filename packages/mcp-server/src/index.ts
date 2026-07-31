#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.REWIND_API_URL ?? "http://localhost:3000";
const API_KEY = process.env.REWIND_API_KEY;

function headers(json = false): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h["content-type"] = "application/json";
  if (API_KEY) h["x-api-key"] = API_KEY;
  return h;
}

async function post(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

const server = new McpServer({ name: "rewind", version: "0.0.1" });

server.registerTool(
  "search_history",
  {
    description: "Semantic search across an agent's past events (decisions, tool calls, memories).",
    inputSchema: { query: z.string(), limit: z.number().optional() },
  },
  async ({ query, limit }) => {
    const data = await post("/search", { query, limit: limit ?? 10, excludeSynthetic: true });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  "find_similar_failures",
  {
    description:
      "Given the agent's current context, return past runs that were flagged and corrected as failures (via a fork/replay) on semantically similar situations, so the agent can avoid repeating them.",
    inputSchema: { context: z.string(), limit: z.number().optional() },
  },
  async ({ context, limit }) => {
    const data = await post("/similar-failures", { context, limit: limit ?? 5 });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  "get_run",
  {
    description: "Fetch the full event timeline of a run by id.",
    inputSchema: { runId: z.string() },
  },
  async ({ runId }) => {
    const res = await fetch(`${API_URL}/runs/${runId}`, { headers: headers() });
    if (!res.ok) throw new Error(`GET /runs/${runId} ${res.status}`);
    return { content: [{ type: "text", text: JSON.stringify(await res.json(), null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[rewind-mcp] connected over stdio (API: ${API_URL})`);
