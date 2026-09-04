import { getStore } from "@/lib/get-store";
import { requireEditor } from "@/lib/auth";
import type { Floor } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireEditor();
    const { id } = await ctx.params;
    const body = (await req.json()) as Partial<Floor>;
    const floor = await getStore().updateFloor(id, body);
    return Response.json(floor);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    await requireEditor();
    const { id } = await ctx.params;
    await getStore().deleteFloor(id);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
