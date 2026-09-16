import { getStore } from "@/lib/get-store";
import { requireEventEditor } from "@/lib/auth";
import type { Floor } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    const existing = await store.getFloor(id);
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    await requireEventEditor(existing.eventId);
    const body = (await req.json()) as Partial<Floor>;
    const floor = await store.updateFloor(id, body);
    return Response.json(floor);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    const existing = await store.getFloor(id);
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    await requireEventEditor(existing.eventId);
    await store.deleteFloor(id);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
