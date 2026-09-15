import { cookies } from "next/headers";
import { createServerSupabase } from "./supabase/server";
import { canUseDemoStore } from "./store";
import { getStore } from "./get-store";

export const DEMO_COOKIE = "maps_demo_session";

export type SessionUser = { email: string; demo: boolean };

export async function getSessionUser(): Promise<SessionUser | null> {
  if (canUseDemoStore()) {
    const jar = await cookies();
    if (jar.get(DEMO_COOKIE)?.value === "1") {
      return { email: "demo@local", demo: true };
    }
    return null;
  }
  const sb = await createServerSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  const email = data.user?.email;
  if (!email) return null;
  const store = getStore();
  if (!(await store.isEditor(email))) return null;
  return { email, demo: false };
}

export async function requireEditor(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const err = new Error("Unauthorized");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  return user;
}
