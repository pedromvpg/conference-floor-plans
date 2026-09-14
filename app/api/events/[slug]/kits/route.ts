import { getStore } from "@/lib/get-store";
import { requireEditor } from "@/lib/auth";
import { isExhibitKitKind, isStageKitKind } from "@/lib/exhibit-kits";
import type { ExhibitKit } from "@/lib/types";

type Ctx = { params: Promise<{ slug: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireEditor();
    const { slug } = await ctx.params;
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const body = (await req.json()) as Partial<ExhibitKit> & { kind?: string };
    if (!isExhibitKitKind(body.kind)) return Response.json({ error: "Unknown kit" }, { status: 400 });
    const existing = (await store.listKits(event.id)).find((k) => k.kind === body.kind);
    if (!existing) return Response.json({ error: "Kit missing" }, { status: 404 });
    const next: ExhibitKit = {
      ...existing,
      widthM: num(body.widthM, existing.widthM),
      depthM: num(body.depthM, existing.depthM),
      wallHeightM: num(body.wallHeightM, existing.wallHeightM),
      platformHeightM: isStageKitKind(body.kind)
        ? num(body.platformHeightM, existing.platformHeightM ?? 0.4)
        : null,
      instructions: typeof body.instructions === "string" ? body.instructions : existing.instructions,
    };
    const saved = await store.upsertKit(next);
    return Response.json(saved);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

function num(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
