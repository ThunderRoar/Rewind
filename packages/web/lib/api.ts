export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// Public demo key sent when the API has auth enabled.
function authHeaders(): Record<string, string> {
  const key = process.env.NEXT_PUBLIC_REWIND_API_KEY;
  return key ? { "x-api-key": key } : {};
}

export interface RunSummary {
  id: string;
  label: string | null;
  status: string;
  region: string;
  agent_slug: string;
  event_count: string | number;
  created_at: string;
  parent_run: string | null;
  forked_from: string | null;
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
    parent_run: string | null;
    forked_from: string | null;
  };
  events: RewindEvent[];
}

export async function getRuns(): Promise<{ runs: RunSummary[] }> {
  const res = await fetch(`${API_URL}/runs`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`GET /runs ${res.status}`);
  return res.json();
}

export async function getRun(id: string, limit = 2000): Promise<RunDetail> {
  const res = await fetch(`${API_URL}/runs/${id}?limit=${limit}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
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
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify({ query, limit, excludeSynthetic: true }),
  });
  if (!res.ok) throw new Error(`POST /search ${res.status}: ${await res.text()}`);
  return res.json();
}

export interface ReplayResult {
  forkId: string;
  originalRunId: string;
  controlRunId: string;
  editedRunId: string;
  originalValue: string;
  editedValue: string;
  costUsd: number;
}

export async function replayFork(runId: string, editedValue: string): Promise<ReplayResult> {
  const res = await fetch(`${API_URL}/replay`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify({ runId, editedValue }),
  });
  if (!res.ok) throw new Error(`POST /replay ${res.status}: ${await res.text()}`);
  return res.json();
}

export interface Stats {
  runs: number;
  events: number;
  forks: number;
  replays: number;
  total_cost: number;
}

export interface AuditEntry {
  owner: string;
  action: string;
  target: string;
  detail: unknown;
  ts: string;
}

export async function getStats(): Promise<Stats> {
  const res = await fetch(`${API_URL}/stats`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`GET /stats ${res.status}`);
  return res.json();
}

export async function getAudit(): Promise<{ entries: AuditEntry[] }> {
  const res = await fetch(`${API_URL}/audit`, { cache: "no-store", headers: authHeaders() });
  if (!res.ok) throw new Error(`GET /audit ${res.status}`);
  return res.json();
}
