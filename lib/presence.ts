import { blobGetText, blobPresencePath, blobPutText, isBlobConfigured } from "./blob-backend";
import { redactEmail } from "./privacy";

export type PresencePeer = { email: string; tabId: string; updatedAt: string };

const TTL_MS = 45_000;

function prune(peers: PresencePeer[], now: number): PresencePeer[] {
  return peers.filter((p) => now - Date.parse(p.updatedAt) < TTL_MS);
}

export async function heartbeatPresence(slug: string, email: string, tabId: string): Promise<PresencePeer[]> {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  if (!isBlobConfigured()) {
    return [{ email, tabId, updatedAt: iso }];
  }
  let peers: PresencePeer[] = [];
  try {
    const raw = await blobGetText(blobPresencePath(slug));
    if (raw) peers = JSON.parse(raw) as PresencePeer[];
  } catch {
    peers = [];
  }
  peers = prune(peers, now).filter((p) => p.tabId !== tabId);
  peers.push({ email, tabId, updatedAt: iso });
  await blobPutText(blobPresencePath(slug), JSON.stringify(peers), "application/json");
  return peers;
}

export function othersEditing(peers: PresencePeer[], email: string, tabId: string): string[] {
  const now = Date.now();
  const names = new Set<string>();
  for (const p of prune(peers, now)) {
    if (p.tabId === tabId) continue;
    if (p.email.toLowerCase() === email.toLowerCase()) continue;
    names.add(redactEmail(p.email));
  }
  return [...names].sort();
}
