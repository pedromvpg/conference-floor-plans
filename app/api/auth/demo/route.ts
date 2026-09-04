import { cookies } from "next/headers";
import { DEMO_COOKIE } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/store";

export async function POST() {
  if (isSupabaseConfigured()) {
    return Response.json({ error: "Demo login disabled" }, { status: 400 });
  }
  const jar = await cookies();
  jar.set(DEMO_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(DEMO_COOKIE);
  return Response.json({ ok: true });
}
