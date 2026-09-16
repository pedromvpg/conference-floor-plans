import { getStore } from "@/lib/get-store";
import { eventsForUser, requireAdmin, requireEditor } from "@/lib/auth";
import { slugify } from "@/lib/store";

export async function GET() {
  try {
    const user = await requireEditor();
    const events = await eventsForUser(user.email);
    return Response.json({
      events: events.map((e) => ({
        id: e.id,
        slug: e.slug,
        name: e.name,
        updatedAt: e.updatedAt,
      })),
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as {
      name?: string;
      slug?: string;
    };
    const name = body.name?.trim();
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    const slug = (body.slug?.trim() || slugify(name)).replace(/^-+|-+$/g, "");
    const event = await getStore().createEvent({
      name,
      slug,
    });
    return Response.json({
      id: event.id,
      slug: event.slug,
      name: event.name,
      isPublic: event.isPublic,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
