import { getStore } from "@/lib/get-store";
import { requireEventEditorBySlug } from "@/lib/auth";
import { fetchAirtableTable, mapAirtableSpeaker } from "@/lib/airtable";
import { resolveAirtable } from "@/lib/airtable-conf";
import { cacheHeadshot } from "@/lib/headshots";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const airtable = resolveAirtable(event);
    if (!airtable.agendaToken || !airtable.speakersBaseId || !airtable.speakersTable) {
      return Response.json({ error: "Speakers CONF_* is missing (speakersTable / airtableToken)." }, { status: 400 });
    }
    const records = await fetchAirtableTable({
      token: airtable.agendaToken,
      baseId: airtable.speakersBaseId,
      table: airtable.speakersTable,
    });
    const mapped = records.map(mapAirtableSpeaker);
    const speakers = [];
    for (const s of mapped) {
      const photoUrl = s.photoSourceUrl
        ? await cacheHeadshot({
            store,
            eventId: event.id,
            airtableId: s.airtableId,
            sourceUrl: s.photoSourceUrl,
          })
        : "";
      speakers.push({
        airtableId: s.airtableId,
        name: s.name,
        photoUrl: photoUrl || s.photoSourceUrl,
      });
    }
    const saved = await store.replaceSpeakers(event.id, speakers);
    return Response.json({ speakers: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
