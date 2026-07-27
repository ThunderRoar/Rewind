export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export interface RunSummary {
  id: string;
  label: string | null;
  status: string;
  region: string;
  agent_slug: string;
  event_count: string | number;
  created_at: string;
}

export interface RewindEvent {
  id: string;
  seq: number;
  parent_event: string | null;
  kind: string;
  payload: unknown;
  payload_sha: string;
  ts: string;
}

export interface RunDetail {
  run: {
    id: string;
    label: string | null;
    status: string;
    region: string;
    agent_slug: string;
    created_at: string;
  };
  events: RewindEvent[];
}

export async function getRuns(): Promise<{ runs: RunSummary[] }> {
  const res = await fetch(`${API_URL}/runs`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /runs ${res.status}`);
  return res.json();
}

export async function getRun(id: string, limit = 2000): Promise<RunDetail> {
  const res = await fetch(`${API_URL}/runs/${id}?limit=${limit}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /runs/${id} ${res.status}`);
  return res.json();
}

export interface SearchResult {
  id: string;
  run_id: string;
  seq: number;
  kind: string;
  ts: string;
  summary: string;
  distance: number;
}

export async function searchEvents(
  query: string,
  limit = 20
): Promise<{ query: string; results: SearchResult[] }> {
  const res = await fetch(`${API_URL}/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, limit, excludeSynthetic: true }),
  });
  if (!res.ok) throw new Error(`POST /search ${res.status}: ${await res.text()}`);
  return res.json();
}
