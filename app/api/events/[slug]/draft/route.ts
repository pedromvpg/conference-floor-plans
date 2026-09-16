import { getStore } from "@/lib/get-store";
import { requireEventEditorBySlug } from "@/lib/auth";
import type { DraftSlice } from "@/lib/types";

type Ctx = { params: Promise<{ slug: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const slice = (await req.json()) as DraftSlice;
    if (!slice?.floors || !slice?.objects) {
      return Response.json({ error: "floors and objects required" }, { status: 400 });
    }
    const saved = await store.replaceDraft(event.id, slice);
    return Response.json(saved);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
