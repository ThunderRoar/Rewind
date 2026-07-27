import {
  BedrockRuntimeClient,
  ConverseCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export async function summarize(text: string): Promise<string> {
  const modelId = process.env.BEDROCK_MODEL_DEFAULT ?? "amazon.nova-lite-v1:0";
  const res = await client.send(
    new ConverseCommand({
      modelId,
      messages: [
        {
          role: "user",
          content: [
            {
              text: `Summarize this AI-agent event in one short sentence for search. No preamble.\n\n${text}`,
            },
          ],
        },
      ],
      inferenceConfig: { maxTokens: 60, temperature: 0 },
    })
  );
  const out = res.output?.message?.content?.[0]?.text?.trim();
  return out && out.length > 0 ? out : text.slice(0, 200);
}

// MUST pass dimensions:512 or Titan returns 1024 and the VECTOR(512) insert fails.
export async function embed(text: string): Promise<number[]> {
  const modelId = process.env.BEDROCK_EMBED_MODEL ?? "amazon.titan-embed-text-v2:0";
  const res = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({ inputText: text, dimensions: 512, normalize: true }),
    })
  );
  const parsed = JSON.parse(new TextDecoder().decode(res.body)) as {
    embedding: number[];
  };
  return parsed.embedding;
}
