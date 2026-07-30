// Bedrock per-1M-token rates (us-east-1, global endpoint, 2026).
const RATES: { match: RegExp; inRate: number; outRate: number }[] = [
  { match: /haiku/i, inRate: 1.0, outRate: 5.0 },
  { match: /sonnet/i, inRate: 2.0, outRate: 10.0 },
  { match: /opus/i, inRate: 5.0, outRate: 25.0 },
  { match: /nova-lite/i, inRate: 0.06, outRate: 0.24 },
];

export function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const rate = RATES.find((r) => r.match.test(model)) ?? { inRate: 2.0, outRate: 10.0 };
  return (inputTokens / 1e6) * rate.inRate + (outputTokens / 1e6) * rate.outRate;
}
