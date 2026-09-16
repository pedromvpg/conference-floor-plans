import { getStore } from "@/lib/get-store";
import { requireEventEditorBySlug } from "@/lib/auth";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { slug, id } = await ctx.params;
    await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const slice = await store.restoreDraftVersion(event.id, id);
    return Response.json(slice);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Restore failed";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
