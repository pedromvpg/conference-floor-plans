import { getStore } from "@/lib/get-store";
import { requireEventEditorBySlug } from "@/lib/auth";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    const user = await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const pub = await store.publish(event.id, user.email);
    return Response.json({
      publishedAt: pub.publishedAt,
      url: `/e/${event.slug}`,
      json: `/e/${event.slug}/map.json`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 500 });
  }
}
