import { getStore } from "@/lib/get-store";
import { canUseDemoStore } from "@/lib/store";
import { clearSession, isBootstrapAdmin, setSessionEmail } from "@/lib/auth";
import { hashPassword, isUsablePassword, verifyPassword } from "@/lib/password";

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  if (!canUseDemoStore()) {
    return Response.json(
      { error: "Use the magic-link form when Supabase Auth is configured." },
      { status: 400 },
    );
  }
  let email = "";
  let password = "";
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    email = body.email?.trim().toLowerCase() ?? "";
    password = body.password ?? "";
  } catch {
    email = "";
  }
  if (!validEmail(email)) {
    return Response.json({ error: "Enter the work email from your invite." }, { status: 400 });
  }
  if (!isUsablePassword(password)) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const store = getStore();
  let user = await store.getUser(email);
  if (!user && isBootstrapAdmin(email)) {
    user = await store.upsertUser(email, {
      role: "admin",
      allEvents: true,
      passwordHash: await hashPassword(password),
    });
  } else if (user && !user.passwordHash) {
    user = await store.upsertUser(email, { passwordHash: await hashPassword(password) });
  } else if (user?.passwordHash) {
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return Response.json({ error: "Email or password is incorrect." }, { status: 403 });
    }
  }
  if (!user) {
    return Response.json(
      { error: "Email or password is incorrect." },
      { status: 403 },
    );
  }
  await setSessionEmail(user.email);
  return Response.json({ ok: true, email: user.email });
}

export async function DELETE() {
  await clearSession();
  return Response.json({ ok: true });
}
