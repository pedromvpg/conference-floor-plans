import { readFile } from "node:fs/promises";
import path from "node:path";
import { isSupabaseConfigured } from "@/lib/store";

type Ctx = { params: Promise<{ path: string[] }> };

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  json: "application/json",
  pdf: "application/pdf",
};

export async function GET(_req: Request, ctx: Ctx) {
  if (isSupabaseConfigured()) {
    return new Response("Not found", { status: 404 });
  }
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  if (rel.includes("..")) return new Response("Bad path", { status: 400 });
  const file = path.join(process.cwd(), ".data", "files", rel);
  try {
    const buf = await readFile(file);
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    return new Response(buf, {
      headers: {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
