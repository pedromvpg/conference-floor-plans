import { getStore } from "@/lib/get-store";
import { requireEventEditorBySlug } from "@/lib/auth";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const body = (await req.json()) as { name?: string };
    const floor = await store.createFloor(event.id, body.name?.trim() || "New plan");
    return Response.json(floor);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
