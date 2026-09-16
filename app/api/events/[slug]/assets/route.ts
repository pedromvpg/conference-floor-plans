import { getStore } from "@/lib/get-store";
import { requireEventEditorBySlug } from "@/lib/auth";
import { newId } from "@/lib/store";
import type { LibraryAssetKind } from "@/lib/types";

type Ctx = { params: Promise<{ slug: string }> };

const TEXTURE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MODEL_TYPES = ["model/gltf-binary", "model/gltf+json", "application/octet-stream"];
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const form = await req.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "") as LibraryAssetKind;
    const name = String(form.get("name") ?? "").trim();
    if (!(file instanceof File)) return Response.json({ error: "file required" }, { status: 400 });
    if (kind !== "texture" && kind !== "model") {
      return Response.json({ error: "kind must be texture or model" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) return Response.json({ error: "File too large (15 MB max)" }, { status: 400 });
    const type = file.type || "application/octet-stream";
    const lower = file.name.toLowerCase();
    if (kind === "texture") {
      const ok = TEXTURE_TYPES.includes(type) || /\.(png|jpe?g|webp|svg)$/.test(lower);
      if (!ok) return Response.json({ error: "Textures: png, jpg, webp, or svg" }, { status: 400 });
    } else {
      const ok = MODEL_TYPES.includes(type) || /\.(glb|gltf)$/.test(lower);
      if (!ok) return Response.json({ error: "Models: glb or gltf" }, { status: 400 });
    }
    const ext = lower.split(".").pop()?.replace(/[^\w]+/g, "") || (kind === "model" ? "glb" : "png");
    const id = newId();
    const path = `assets/${event.id}/${id}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await store.putFile(path, buf, type);
    const asset = await store.createAsset({
      eventId: event.id,
      kind,
      name: name || file.name.replace(/\.[^.]+$/, ""),
      url,
      contentType: type,
    });
    return Response.json(asset);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
