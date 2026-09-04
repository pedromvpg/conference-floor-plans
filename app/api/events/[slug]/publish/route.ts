import { getStore } from "@/lib/get-store";
import { requireEditor } from "@/lib/auth";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const user = await requireEditor();
    const { slug } = await ctx.params;
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
