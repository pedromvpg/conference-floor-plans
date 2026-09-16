import { getStore } from "./get-store";
import { canEditEvent, canViewEvent, getSessionUser } from "./auth";

function fileUrl(rel: string): string {
  return `/api/files/${rel.replace(/^\/+/, "")}`;
}

async function eventIdForFile(rel: string): Promise<string | null> {
  const parts = rel.split("/").filter(Boolean);
  const kind = parts[0];
  const id = parts[1];
  if (!kind || !id) return null;
  if (kind === "assets" || kind === "headshots" || kind === "logos") return id;
  if (kind === "underlays" || kind === "originals") {
    const floor = await getStore().getFloor(id);
    return floor?.eventId ?? null;
  }
  return null;
}

function snapshotMentions(snapshot: unknown, rel: string): boolean {
  const marker = fileUrl(rel);
  try {
    return JSON.stringify(snapshot).includes(marker);
  } catch {
    return false;
  }
}

/** Serve originals only to editors. Public/viewer traffic gets published snapshot files only. */
export async function mayReadStoredFile(rel: string): Promise<boolean> {
  if (!rel || rel.includes("..")) return false;
  const eventId = await eventIdForFile(rel);
  if (!eventId) return false;
  const store = getStore();
  const events = await store.listEvents();
  const event = events.find((e) => e.id === eventId);
  if (!event) return false;
  const user = await getSessionUser();
  const isOriginal = rel.startsWith("originals/");
  if (user && (await canEditEvent(user.email, eventId))) {
    return true;
  }
  if (isOriginal) return false;
  const pub = await store.getPublicationBySlug(event.slug);
  if (!pub || !snapshotMentions(pub.snapshot, rel)) return false;
  if (event.isPublic) return true;
  return Boolean(user && (await canViewEvent(user.email, eventId)));
}
