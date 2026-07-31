import type { FastifyReply, FastifyRequest } from "fastify";

// REWIND_API_KEYS is a comma-separated list of `key:owner` pairs, e.g.
//   judge-key-abc:me,teamx-key:teamx
// If it's empty, auth is OFF (local dev) and every request is allowed.
function parseKeys(): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of (process.env.REWIND_API_KEYS ?? "").split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [key, owner] = trimmed.split(":");
    if (key) map.set(key.trim(), (owner ?? key).trim());
  }
  return map;
}

export function authEnabled(): boolean {
  return parseKeys().size > 0;
}

export function ownerForKey(key: string | undefined): string | null {
  if (!key) return null;
  return parseKeys().get(key) ?? null;
}

// onRequest hook: gate everything except health checks behind a valid API key,
// and attach the key's owner to the request for attribution/audit.
export async function authHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const path = req.url.split("?")[0] ?? req.url;
  if (path.startsWith("/health")) return;

  if (!authEnabled()) {
    req.ownerScope = process.env.REWIND_DEV_OWNER ?? "demo";
    return;
  }

  const key = req.headers["x-api-key"] as string | undefined;
  const owner = ownerForKey(key);
  if (!owner) {
    reply.code(401);
    await reply.send({ error: "unauthorized", message: "missing or invalid x-api-key" });
    return;
  }
  req.ownerScope = owner;
}

declare module "fastify" {
  interface FastifyRequest {
    ownerScope?: string;
  }
}
