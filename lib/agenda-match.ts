import type { AgendaSession, AgendaSpeaker, MapDocument, MapObject } from "./types";
import { isStageObject } from "./appearance";

export function stageNameMatches(sessionStage: string, objectName: string): boolean {
  const a = sessionStage.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const b = objectName.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export function upcomingOnStage(
  sessions: AgendaSession[] | MapDocument["sessions"],
  object: MapObject,
  nowUnix = Date.now() / 1000,
): (AgendaSession | NonNullable<MapDocument["sessions"]>[number]) | null {
  if (!isStageObject(object) && object.appearance !== "stage") return null;
  const name = `${object.name} ${object.boothNumber}`.trim();
  const list = (sessions ?? []).filter((s) => stageNameMatches(s.stage, name) || stageNameMatches(s.stage, object.name));
  if (!list.length) return null;
  const dated = [...list].sort((a, b) => (a.startUnix ?? 0) - (b.startUnix ?? 0));
  return dated.find((s) => (s.endUnix ?? s.startUnix ?? 0) >= nowUnix) ?? dated[dated.length - 1] ?? null;
}

export function speakersForSession(
  speakerIds: string[],
  speakers: AgendaSpeaker[] | MapDocument["speakers"],
): { airtableId: string; name: string; photoUrl: string }[] {
  const byId = new Map((speakers ?? []).map((s) => [s.airtableId, s]));
  return speakerIds
    .map((id) => byId.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
}
