import { readFile } from "node:fs/promises";
import path from "node:path";
import { blobFilePath, blobGetBytes, isBlobConfigured } from "@/lib/blob-backend";
import { isSupabaseConfigured } from "@/lib/store";
import { mayReadStoredFile } from "@/lib/file-access";

type Ctx = { params: Promise<{ path: string[] }> };

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  json: "application/json",
  pdf: "application/pdf",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
};

export async function GET(_req: Request, ctx: Ctx) {
  if (isSupabaseConfigured()) {
    return new Response("Not found", { status: 404 });
  }
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  if (rel.includes("..") || !(await mayReadStoredFile(rel))) {
    return new Response("Not found", { status: 404 });
  }
  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext] || "application/octet-stream";
  if (isBlobConfigured()) {
    const file = await blobGetBytes(blobFilePath(rel));
    if (!file) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.contentType || type,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }
  const file = path.join(process.cwd(), ".data", "files", rel);
  try {
    const buf = await readFile(file);
    return new Response(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
