import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import type { UserRole } from "@/lib/access";
import { withoutPasswordHash } from "@/lib/password";

export async function GET() {
  try {
    await requireAdmin();
    const store = getStore();
    const [users, grants, events] = await Promise.all([
      store.listUsers(),
      store.listEventEditors(),
      store.listEvents(),
    ]);
    return Response.json({
      users: users.map(withoutPasswordHash),
      grants,
      events: events.map((e) => ({ id: e.id, slug: e.slug, name: e.name, isPublic: e.isPublic })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message === "Forbidden" ? 403 : 401;
    return Response.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as {
      email?: string;
      role?: UserRole;
      eventIds?: string[];
      allEvents?: boolean;
    };
    const email = body.email?.trim().toLowerCase();
    if (!email) return Response.json({ error: "email required" }, { status: 400 });
    const store = getStore();
    const users = await store.listUsers();
    const existing = users.find((u) => u.email === email);
    if ((body.role === "editor" || body.role === "viewer") && existing?.role === "admin") {
      const admins = users.filter((u) => u.role === "admin");
      if (admins.length <= 1) {
        return Response.json({ error: "Cannot demote the last admin." }, { status: 400 });
      }
    }
    const user = await store.upsertUser(email, {
      ...(body.role ? { role: body.role } : {}),
      ...(typeof body.allEvents === "boolean" ? { allEvents: body.allEvents } : {}),
    });
    if (user.role !== "admin" && !user.allEvents && Array.isArray(body.eventIds)) {
      await store.setEventEditors(email, body.eventIds);
    }
    return Response.json({ user: withoutPasswordHash(user) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requireAdmin();
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
    if (email === actor.email) {
      return Response.json({ error: "You cannot delete your own account." }, { status: 400 });
    }
    const store = getStore();
    const users = await store.listUsers();
    const existing = users.find((u) => u.email === email);
    if (!existing) return Response.json({ error: "User not found" }, { status: 404 });
    if (existing.role === "admin") {
      const admins = users.filter((u) => u.role === "admin");
      if (admins.length <= 1) {
        return Response.json({ error: "Cannot delete the last admin." }, { status: 400 });
      }
    }
    await store.deleteUser(email);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
