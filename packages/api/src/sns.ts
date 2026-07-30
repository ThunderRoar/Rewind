import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

const TOPIC = process.env.SNS_TOPIC_ARN;
const sns = new SNSClient({ region: process.env.AWS_REGION ?? "us-east-1" });

export function snsEnabled(): boolean {
  return Boolean(TOPIC);
}

// Publish an incident notification. No-op (and never throws) if SNS isn't configured.
export async function publishIncident(subject: string, message: string): Promise<void> {
  if (!TOPIC) return;
  try {
    await sns.send(
      new PublishCommand({ TopicArn: TOPIC, Subject: subject.slice(0, 100), Message: message })
    );
  } catch (err) {
    console.error("[sns] publish failed:", err instanceof Error ? err.message : err);
  }
}
