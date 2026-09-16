import { get, put } from "@vercel/blob";

const DB_PATH = "maps/db.json";
const FILE_PREFIX = "maps/files/";
const PRESENCE_PREFIX = "maps/presence/";

export function isBlobConfigured(): boolean {
  const token = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  const oidc = Boolean(process.env.BLOB_STORE_ID?.trim() && process.env.VERCEL_OIDC_TOKEN?.trim());
  return token || oidc;
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const buf = await new Response(stream).arrayBuffer();
  return Buffer.from(buf);
}

export async function blobGetText(pathname: string): Promise<string | null> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return (await streamToBuffer(result.stream)).toString("utf8");
}

export async function blobGetBytes(pathname: string): Promise<{ body: Buffer; contentType: string } | null> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return {
    body: await streamToBuffer(result.stream),
    contentType: result.blob.contentType || "application/octet-stream",
  };
}

export async function blobPutText(pathname: string, text: string, contentType: string): Promise<void> {
  await put(pathname, text, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    cacheControlMaxAge: 60,
  });
}

export async function blobPutBytes(pathname: string, body: Buffer, contentType: string): Promise<void> {
  await put(pathname, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
}

export async function loadBlobDbJson(): Promise<string | null> {
  return blobGetText(DB_PATH);
}

export async function saveBlobDbJson(raw: string): Promise<void> {
  await blobPutText(DB_PATH, raw, "application/json");
}

export function blobFilePath(rel: string): string {
  return `${FILE_PREFIX}${rel.replace(/^\/+/, "")}`;
}

export function blobPresencePath(slug: string): string {
  return `${PRESENCE_PREFIX}${slug}.json`;
}
