import { requireEditor } from "@/lib/auth";
import { getStore } from "@/lib/get-store";
import { canUseDemoStore } from "@/lib/store";
import { hashPassword, isUsablePassword, verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  try {
    const session = await requireEditor();
    if (!canUseDemoStore()) {
      return Response.json(
        { error: "Change your password with the Supabase sign-in on this deployment." },
        { status: 400 },
      );
    }
    const body = (await req.json()) as { currentPassword?: string; newPassword?: string };
    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";
    if (!isUsablePassword(newPassword)) {
      return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }
    const store = getStore();
    const user = await store.getUser(session.email);
    if (!user) {
      return Response.json({ error: "Account not found." }, { status: 404 });
    }
    if (user.passwordHash) {
      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) {
        return Response.json({ error: "Current password is incorrect." }, { status: 403 });
      }
    }
    await store.upsertUser(user.email, { passwordHash: await hashPassword(newPassword) });
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
