import type { RewindEvent } from "@/lib/api";

// Content signature for divergence so identical decisions don't falsely read as divergent. 
export function sig(e: RewindEvent | undefined): string {
  if (!e) return "∅";
  const p = { ...(e.payload as Record<string, unknown>) };
  delete p.latencyMs;
  return `${e.kind}|${JSON.stringify(p)}`;
}
