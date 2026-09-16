import { getStore } from "@/lib/get-store";
import { requireEventEditor } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    const asset = await store.getAsset(id);
    if (!asset) return Response.json({ error: "Not found" }, { status: 404 });
    await requireEventEditor(asset.eventId);
    await store.deleteAsset(id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
