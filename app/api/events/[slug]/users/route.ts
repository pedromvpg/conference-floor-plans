import { requireEventEditorBySlug } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { grantAccess, parseEventAccess } from "@/lib/access";
import { withoutPasswordHash } from "@/lib/password";

type Ctx = { params: Promise<{ slug: string }> };

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const [users, grants] = await Promise.all([store.listUsers(), store.listEventEditors()]);
    const inherited = users
      .filter((u) => u.role === "admin" || u.allEvents)
      .map((u) => ({
        ...withoutPasswordHash(u),
        source: "inherited" as const,
        access: u.role === "viewer" ? ("viewer" as const) : ("editor" as const),
      }));
    const inheritedEmails = new Set(inherited.map((u) => u.email));
    const assigned = grants
      .filter((g) => g.eventId === event.id && !inheritedEmails.has(g.email))
      .map((g) => {
        const user = users.find((u) => u.email === g.email);
        return {
          email: g.email,
          role: user?.role ?? "editor",
          allEvents: false,
          createdAt: user?.createdAt ?? "",
          source: "grant" as const,
          access: grantAccess(g),
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));
    return Response.json({
      event: { id: event.id, slug: event.slug, name: event.name },
      people: [...inherited, ...assigned],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message === "Forbidden" ? 403 : message === "Not found" ? 404 : 401;
    return Response.json({ error: message }, { status });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    const actor = await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const body = (await req.json()) as { email?: string; access?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!validEmail(email)) return Response.json({ error: "Valid email required" }, { status: 400 });
    const access = parseEventAccess(body.access);
    const existing = await store.getUser(email);
    if (existing?.role === "admin" || existing?.allEvents) {
      return Response.json({ error: "That person already has access to every event." }, { status: 400 });
    }
    if (existing) {
      await store.setEventAccess(email, event.id, access);
      if (access === "editor" && existing.role === "viewer") {
        await store.upsertUser(email, { role: "editor" });
      }
      return Response.json({ ok: true, invited: false });
    }
    const origin = new URL(req.url).origin;
    const created = await store.createInvite({
      email,
      role: access,
      eventIds: [event.id],
      createdBy: actor.email,
      origin,
    });
    return Response.json({ ok: true, invited: true, url: created.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const body = (await req.json()) as { email?: string; access?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!email) return Response.json({ error: "email required" }, { status: 400 });
    const existing = await store.getUser(email);
    if (existing?.role === "admin" || existing?.allEvents) {
      return Response.json({ error: "Change inherited access on /admin." }, { status: 400 });
    }
    const access = parseEventAccess(body.access);
    await store.setEventAccess(email, event.id, access);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const url = new URL(req.url);
    let email = url.searchParams.get("email")?.trim().toLowerCase() ?? "";
    if (!email) {
      try {
        const body = (await req.json()) as { email?: string };
        email = body.email?.trim().toLowerCase() ?? "";
      } catch {
        email = "";
      }
    }
    if (!email) return Response.json({ error: "email required" }, { status: 400 });
    const existing = await store.getUser(email);
    if (existing?.role === "admin" || existing?.allEvents) {
      return Response.json({ error: "Remove inherited access on /admin." }, { status: 400 });
    }
    await store.setEventAccess(email, event.id, null);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
