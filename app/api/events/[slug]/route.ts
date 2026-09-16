import { getStore } from "@/lib/get-store";
import { requireEventEditorBySlug } from "@/lib/auth";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    await requireEventEditorBySlug(slug);
    const draft = await getStore().getDraft(slug);
    if (!draft) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({
      ...draft,
      event: { ...draft.event, airtableToken: draft.event.airtableToken ? "••••" : "" },
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const body = (await req.json()) as { name?: string };
    const updated = await store.updateEvent(event.id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
    });
    return Response.json({ ...updated, airtableToken: updated.airtableToken ? "••••" : "" });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
