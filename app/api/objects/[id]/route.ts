import { getStore } from "@/lib/get-store";
import { requireEventEditor } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    const obj = await store.getObject(id);
    if (!obj) return Response.json({ error: "Not found" }, { status: 404 });
    const floor = await store.getFloor(obj.floorId);
    if (!floor) return Response.json({ error: "Not found" }, { status: 404 });
    await requireEventEditor(floor.eventId);
    await store.deleteObject(id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
