// Print Bedrock model + inference-profile IDs to paste into .env.
// Run from repo root:  node --env-file=.env packages/api/scripts/list-models.mjs
//
// For Claude, use the INFERENCE PROFILE id (starts with "us.") for BEDROCK_MODEL_DEMO
// (Sonnet) and BEDROCK_MODEL_CHEAP (Haiku). Nova Lite + Titan work as bare model ids.
import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
} from "@aws-sdk/client-bedrock";

const client = new BedrockClient({ region: process.env.AWS_REGION ?? "us-east-1" });

console.log("=== Inference profiles (use these for Claude Sonnet/Haiku) ===");
try {
  const res = await client.send(new ListInferenceProfilesCommand({}));
  for (const p of res.inferenceProfileSummaries ?? []) {
    if (/anthropic|nova|titan/i.test(p.inferenceProfileId ?? "")) {
      console.log(`${p.inferenceProfileId}\t${p.inferenceProfileName}`);
    }
  }
} catch (e) {
  console.error("profiles error:", e.message);
}

console.log("\n=== Foundation models (Anthropic / Nova / Titan) ===");
try {
  const res = await client.send(new ListFoundationModelsCommand({}));
  for (const m of res.modelSummaries ?? []) {
    if (/anthropic|amazon\.(nova|titan)/i.test(m.modelId ?? "")) {
      console.log(`${m.modelId}\t${m.modelName}`);
    }
  }
} catch (e) {
  console.error("models error:", e.message);
}
