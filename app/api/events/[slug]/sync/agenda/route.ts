import { getStore } from "@/lib/get-store";
import { requireEventEditorBySlug } from "@/lib/auth";
import { fetchAirtableTable, mapAirtableSession } from "@/lib/airtable";
import { resolveAirtable } from "@/lib/airtable-conf";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { slug } = await ctx.params;
    await requireEventEditorBySlug(slug);
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const airtable = resolveAirtable(event);
    if (!airtable.agendaToken || !airtable.agendaBaseId || !airtable.agendaTable) {
      return Response.json({ error: "Agenda CONF_* is missing (agendaBaseId / agendaTable / airtableToken)." }, { status: 400 });
    }
    const records = await fetchAirtableTable({
      token: airtable.agendaToken,
      baseId: airtable.agendaBaseId,
      table: airtable.agendaTable,
    });
    const mapped = records.map(mapAirtableSession).filter((s): s is NonNullable<typeof s> => Boolean(s));
    const sessions = await store.replaceSessions(event.id, mapped);
    return Response.json({ sessions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
