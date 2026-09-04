import { getStore } from "@/lib/get-store";
import { requireEditor } from "@/lib/auth";
import { fetchAirtableSponsors, mapAirtableSponsor } from "@/lib/airtable";
import { cacheLogo } from "@/lib/logos";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    await requireEditor();
    const { slug } = await ctx.params;
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    if (!event.airtableToken || !event.airtableBaseId || !event.airtableTable) {
      return Response.json({ error: "Airtable is not configured for this event" }, { status: 400 });
    }
    const records = await fetchAirtableSponsors({
      token: event.airtableToken,
      baseId: event.airtableBaseId,
      table: event.airtableTable,
    });
    const mapped = records
      .map((r) => mapAirtableSponsor(r, event.airtableEventCode))
      .filter((s) => {
        if (!event.airtableEventCode) return true;
        return Boolean(s.tier);
      });
    const withLogos = [];
    for (const s of mapped) {
      const logoUrl = s.colorLogoUrl
        ? await cacheLogo({
            store,
            eventId: event.id,
            airtableId: s.airtableId,
            kind: "color",
            sourceUrl: s.colorLogoUrl,
          })
        : "";
      const logoWhiteUrl = s.whiteLogoUrl
        ? await cacheLogo({
            store,
            eventId: event.id,
            airtableId: s.airtableId,
            kind: "white",
            sourceUrl: s.whiteLogoUrl,
          })
        : "";
      withLogos.push({
        airtableId: s.airtableId,
        name: s.name,
        tier: s.tier,
        boothNumber: s.boothNumber,
        logoUrl: logoUrl || s.colorLogoUrl,
        logoWhiteUrl: logoWhiteUrl || s.whiteLogoUrl,
      });
    }
    const sponsors = await store.replaceSponsors(event.id, withLogos);
    return Response.json({ sponsors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
