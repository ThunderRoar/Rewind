import type { FastifyReply, FastifyRequest } from "fastify";

// A key grants access as a principal in one org (company). With an agent scope
// it's a "member" (sees only that sub-agent); without, it's an org "admin"
// (sees every sub-agent in the company). Cross-org access is always denied.
//
// `demo` role reads and replays (capped, see routes/replay.ts) but can never ingest. It's the only role safe to ship in a browser bundle, which NEXT_PUBLIC_REWIND_API_KEY necessarily does.
export type Role = "admin" | "member" | "demo";
const ROLES = new Set<string>(["admin", "member", "demo"]);

export interface Principal {
  org: string;
  agent?: string;
  role: Role;
}

// REWIND_API_KEYS is a comma-separated list of `key:org[:agent][:role]`, e.g.
//   admin-key:acme,member-key:acme:acme-refund-agent,judge-key:acme::demo
// The agent slot may be empty (`::`) to give an org-wide key an explicit role.
// Role defaults preserve the pre-role behaviour: org-only => admin, agent-scoped => member.
// Empty => auth OFF (local dev), every request allowed and unscoped.
function parseKeys(): Map<string, Principal> {
  const map = new Map<string, Principal>();
  for (const part of (process.env.REWIND_API_KEYS ?? "").split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [key, org, agentRaw, roleRaw] = trimmed.split(":").map((s) => s.trim());
    if (!key || !org) continue;
    const agent = agentRaw || undefined;
    if (roleRaw && !ROLES.has(roleRaw)) continue;
    const role = (roleRaw as Role | undefined) ?? (agent ? "member" : "admin");
    map.set(key, agent ? { org, agent, role } : { org, role });
  }
  return map;
}

export function authEnabled(): boolean {
  return parseKeys().size > 0;
}

export function principalForKey(key: string | undefined): Principal | null {
  if (!key) return null;
  return parseKeys().get(key) ?? null;
}

// onRequest hook: gate every non-health route behind a valid key and attach the
// caller's org (+ optional agent) so reads can be isolated per company.
export async function authHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const path = req.url.split("?")[0] ?? req.url;
  if (path.startsWith("/health")) return;

  if (!authEnabled()) return; // dev: unscoped

  const principal = principalForKey(req.headers["x-api-key"] as string | undefined);
  if (!principal) {
    reply.code(401);
    await reply.send({ error: "unauthorized", message: "missing or invalid x-api-key" });
    return;
  }
  req.orgScope = principal.org;
  req.agentScope = principal.agent;
  req.role = principal.role;

  // Ingestion is closed to demo keys. Checked on method as well as path because
  // `/runs` is a read on GET and a write on POST.
  if (principal.role === "demo" && req.method === "POST" && WRITE_PATHS.has(path)) {
    reply.code(403);
    await reply.send({
      error: "forbidden",
      message: "this key is read-only (demo role); it cannot write events or create runs",
    });
  }
}

const WRITE_PATHS = new Set(["/events", "/runs"]);

declare module "fastify" {
  interface FastifyRequest {
    orgScope?: string;
    agentScope?: string;
    role?: Role;
  }
}
