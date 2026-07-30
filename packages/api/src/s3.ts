import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET_OVERFLOW;
const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });

// Payloads larger than this go to S3; CockroachDB keeps a stub + the pointer.
export const OVERFLOW_BYTES = Number(process.env.OVERFLOW_BYTES ?? 64 * 1024);

export function overflowEnabled(): boolean {
  return Boolean(BUCKET);
}

export function isOverflow(payloadJson: string): boolean {
  return overflowEnabled() && Buffer.byteLength(payloadJson, "utf8") > OVERFLOW_BYTES;
}

// Store the full payload in S3; return an s3://bucket/key pointer.
export async function putOverflow(runId: string, seq: number, payloadJson: string): Promise<string> {
  const key = `events/${runId}/${seq}-${Date.now()}.json`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: payloadJson,
      ContentType: "application/json",
    })
  );
  return `s3://${BUCKET}/${key}`;
}

// Fetch a full overflow payload back from its s3:// pointer.
export async function getOverflow(uri: string): Promise<unknown> {
  const m = uri.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!m) throw new Error(`bad s3 uri: ${uri}`);
  const res = await s3.send(new GetObjectCommand({ Bucket: m[1], Key: m[2] }));
  const text = await res.Body!.transformToString();
  return JSON.parse(text);
}
