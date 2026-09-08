import { getStore } from "@/lib/get-store";
import { requireEditor } from "@/lib/auth";
import { fetchAirtableSponsors, mapAirtableSponsor } from "@/lib/airtable";
import { resolveAirtable } from "@/lib/airtable-conf";
import { cacheLogo } from "@/lib/logos";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    await requireEditor();
    const { slug } = await ctx.params;
    const store = getStore();
    const event = await store.getEventBySlug(slug);
    if (!event) return Response.json({ error: "Not found" }, { status: 404 });
    const airtable = resolveAirtable(event);
    if (!airtable.sponsorsToken || !airtable.sponsorsBaseId || !airtable.sponsorsTable) {
      return Response.json(
        { error: "Airtable CONF_* is missing. Add CONF_BITCOINASIA2026 to .env.local / Vercel." },
        { status: 400 },
      );
    }
    const records = await fetchAirtableSponsors({
      token: airtable.sponsorsToken,
      baseId: airtable.sponsorsBaseId,
      table: airtable.sponsorsTable,
    });
    const mapped = records
      .map((r) => mapAirtableSponsor(r, airtable.eventCode))
      .filter((s) => {
        if (!airtable.eventCode) return true;
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
      withLogos.push({
        airtableId: s.airtableId,
        name: s.name,
        tier: s.tier,
        boothNumber: s.boothNumber,
        logoUrl: logoUrl || s.colorLogoUrl,
        logoWhiteUrl: "",
      });
    }
    const sponsors = await store.replaceSponsors(event.id, withLogos);
    return Response.json({ sponsors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
