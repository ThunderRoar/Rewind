import type { FastifyReply, FastifyRequest } from "fastify";

// A key grants access as a principal in one org (company). With an agent scope
// it's a "member" (sees only that sub-agent); without, it's an org "admin"
// (sees every sub-agent in the company). Cross-org access is always denied.
export interface Principal {
  org: string;
  agent?: string;
}

// REWIND_API_KEYS is a comma-separated list of `key:org[:agent]`, e.g.
//   admin-key:acme,member-key:acme:acme-refund-agent
// Empty => auth OFF (local dev), every request allowed and unscoped.
function parseKeys(): Map<string, Principal> {
  const map = new Map<string, Principal>();
  for (const part of (process.env.REWIND_API_KEYS ?? "").split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [key, org, agent] = trimmed.split(":").map((s) => s.trim());
    if (key && org) map.set(key, agent ? { org, agent } : { org });
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
}

declare module "fastify" {
  interface FastifyRequest {
    orgScope?: string;
    agentScope?: string;
  }
}
