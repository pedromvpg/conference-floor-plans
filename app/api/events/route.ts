import { getStore } from "@/lib/get-store";
import { requireEditor } from "@/lib/auth";
import { slugify } from "@/lib/store";

export async function GET() {
  try {
    await requireEditor();
    const events = await getStore().listEvents();
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
    await requireEditor();
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
    return Response.json(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
