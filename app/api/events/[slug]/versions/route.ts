import { getStore } from "@/lib/get-store";
import { requireEventEditorBySlug } from "@/lib/auth";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const versions = await store.listDraftVersions(event.id);
    return Response.json({ versions });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    const user = await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const version = await store.saveDraftVersion(event.id, user.email);
    return Response.json({ version });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
