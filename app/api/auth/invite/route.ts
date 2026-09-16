import { requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import type { UserRole } from "@/lib/access";
import { inviteToClient, parseUserRole } from "@/lib/access";

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const origin = new URL(req.url).origin;
    const invites = await getStore().listInvites();
    return Response.json({
      invites: invites.map((invite) => inviteToClient(invite, origin)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    const status = message === "Forbidden" ? 403 : 401;
    return Response.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await req.json()) as {
      email?: string;
      role?: UserRole;
      eventIds?: string[] | "all";
    };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!validEmail(email)) return Response.json({ error: "Valid email required" }, { status: 400 });
    const role: UserRole = parseUserRole(body.role);
    const eventIds = body.eventIds === "all" || role === "admin" ? "all" : (body.eventIds ?? []);
    const origin = new URL(req.url).origin;
    const created = await getStore().createInvite({
      email,
      role,
      eventIds,
      createdBy: admin.email,
      origin,
    });
    return Response.json(inviteToClient(created, origin));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as { id?: string };
    const id = body.id?.trim() ?? "";
    if (!id) return Response.json({ error: "Invite id required" }, { status: 400 });
    await getStore().deleteInvite(id);
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}
