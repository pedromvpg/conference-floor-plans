import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";
import { canUseDemoStore } from "./store";
import { getStore } from "./get-store";
import { isBootstrapAdmin, type EventAccess, type UserRole } from "./access";

export const DEMO_COOKIE = "maps_demo_session";

export type SessionUser = { email: string; demo: boolean; role: UserRole };

function parseDemoEmail(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw === "1") return "demo@local";
  const email = decodeURIComponent(raw).trim().toLowerCase();
  if (!email.includes("@")) return null;
  return email;
}

export async function setSessionEmail(email: string) {
  const jar = await cookies();
  jar.set(DEMO_COOKIE, email.toLowerCase(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(DEMO_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (canUseDemoStore()) {
    const jar = await cookies();
    const email = parseDemoEmail(jar.get(DEMO_COOKIE)?.value);
    if (!email) return null;
    const store = getStore();
    const user = await store.getUser(email);
    if (user) return { email: user.email, demo: true, role: user.role };
    return null;
  }
  const sb = await createServerSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  const email = data.user?.email;
  if (!email) return null;
  const store = getStore();
  const user = await store.getUser(email);
  if (!user) return null;
  return { email: user.email, demo: false, role: user.role };
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

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireEditor();
  if (user.role !== "admin") {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return user;
}

export async function canEditEvent(email: string, eventId: string): Promise<boolean> {
  const ids = await getStore().listEventIdsForEditor(email);
  if (ids === "all") return true;
  return ids.includes(eventId);
}

export async function canViewEvent(email: string, eventId: string): Promise<boolean> {
  if (await canEditEvent(email, eventId)) return true;
  const ids = await getStore().listEventIdsForViewer(email);
  if (ids === "all") return true;
  return ids.includes(eventId);
}

export async function eventAccessFor(email: string, eventId: string): Promise<EventAccess | null> {
  if (await canEditEvent(email, eventId)) return "editor";
  if (await canViewEvent(email, eventId)) return "viewer";
  return null;
}

export async function requireEventEditor(eventId: string): Promise<SessionUser> {
  const user = await requireEditor();
  if (!(await canEditEvent(user.email, eventId))) {
    const err = new Error("Forbidden");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return user;
}

export async function requireEventEditorBySlug(slug: string): Promise<SessionUser> {
  const event = await getStore().getEventBySlug(slug);
  if (!event) {
    const err = new Error("Not found");
    (err as Error & { status: number }).status = 404;
    throw err;
  }
  return requireEventEditor(event.id);
}

export async function eventsForUser(email: string) {
  const store = getStore();
  const all = await store.listEvents();
  const ids = await store.listEventIdsForViewer(email);
  if (ids === "all") return all;
  const allow = new Set(ids);
  return all.filter((e) => allow.has(e.id));
}

export async function requireStudio(slug: string) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const event = await getStore().getEventBySlug(slug);
  if (!event || !(await canEditEvent(user.email, event.id))) redirect("/events");
  return { user, event };
}

export { isBootstrapAdmin };
