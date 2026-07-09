import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const endpoint = import.meta.env.VITE_S3_ENDPOINT;
const region = import.meta.env.VITE_S3_REGION;
const bucket = import.meta.env.VITE_S3_BUCKET;
const accessKeyId = import.meta.env.VITE_S3_ACCESS_KEY_ID;
const secretAccessKey = import.meta.env.VITE_S3_SECRET_ACCESS_KEY;

function assertConfig() {
  if (!endpoint) throw new Error("Missing VITE_S3_ENDPOINT");
  if (!region) throw new Error("Missing VITE_S3_REGION");
  if (!bucket) throw new Error("Missing VITE_S3_BUCKET");
  if (!accessKeyId) throw new Error("Missing VITE_S3_ACCESS_KEY_ID");
  if (!secretAccessKey) throw new Error("Missing VITE_S3_SECRET_ACCESS_KEY");
}

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function streamToText(body: any): Promise<string> {
  if (!body) return "";

  if (typeof body.transformToString === "function") {
    return await body.transformToString();
  }

  return await new Response(body).text();
}

export async function readS3JSON<T = unknown>(path: string): Promise<T> {
  assertConfig();

  const res = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: path.replace(/^\//, ""),
    })
  );

  const text = await streamToText(res.Body);
  return JSON.parse(text) as T;
}

export async function writeS3JSON(
  path: string,
  data: unknown
): Promise<void> {
  assertConfig();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: path.replace(/^\//, ""),
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    })
  );
}