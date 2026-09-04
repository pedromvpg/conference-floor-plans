import { getStore } from "@/lib/get-store";
import { requireEditor } from "@/lib/auth";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    await requireEditor();
    const { slug } = await ctx.params;
    const draft = await getStore().getDraft(slug);
    if (!draft) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(draft);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    await requireEditor();
    const { slug } = await ctx.params;
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();
    const updated = await store.updateEvent(event.id, body);
    return Response.json({ ...updated, airtableToken: updated.airtableToken ? "••••" : "" });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
