import { getStore } from "./get-store";
import { canViewEvent, type SessionUser } from "./auth";

export async function mayViewMap(
  slug: string,
  user: SessionUser | null,
): Promise<{ ok: boolean; unpublished: boolean }> {
  const store = getStore();
  const event = await store.getEventBySlug(slug);
  if (!event) return { ok: false, unpublished: false };
  const pub = await store.getPublicationBySlug(slug);
  const allowed = user ? await canViewEvent(user.email, event.id) : false;
  if (allowed) {
    return { ok: true, unpublished: !pub };
  }
  if (event.isPublic && pub) {
    return { ok: true, unpublished: false };
  }
  return { ok: false, unpublished: false };
}
