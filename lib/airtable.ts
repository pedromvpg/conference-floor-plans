export function httpUrl(s: unknown): string {
  const t = s != null && typeof s === "string" ? s.trim() : "";
  return t.startsWith("http://") || t.startsWith("https://") ? t : "";
}

const IMAGE_NAME = /\.(svg|png|jpe?g|webp|gif)(\?|$)/i;

function firstImageAttachment(arr: unknown): string {
  if (!Array.isArray(arr) || !arr.length) return "";
  for (const a of arr) {
    if (!a || typeof a !== "object") continue;
    const rec = a as { url?: string; filename?: string; type?: string };
    const url = rec.url;
    if (!url) continue;
    const fn = rec.filename || "";
    const type = rec.type || "";
    if (IMAGE_NAME.test(fn) || IMAGE_NAME.test(url) || type.startsWith("image/")) {
      return url;
    }
  }
  return "";
}

function first(candidates: [string, string][]): { field: string | null; url: string } {
  for (const [field, url] of candidates) {
    if (url) return { field, url };
  }
  return { field: null, url: "" };
}

export function resolveColorLogoSource(fields: Record<string, unknown>): { field: string | null; url: string } {
  return first([
    ["Logo Color URL", httpUrl(fields["Logo Color URL"])],
    ["Logo Color", firstImageAttachment(fields["Logo Color"])],
    ["Webflow Original Image URL", httpUrl(fields["Webflow Original Image URL"])],
    ["Webflow SVG Image URL", httpUrl(fields["Webflow SVG Image URL"])],
    ["SVG Company Logos", firstImageAttachment(fields["SVG Company Logos"])],
    ["Logo Formatted", firstImageAttachment(fields["Logo Formatted"])],
    ["SVG Logo", firstImageAttachment(fields["SVG Logo"])],
  ]);
}

export function resolveWhiteLogoSource(fields: Record<string, unknown>): { field: string | null; url: string } {
  return first([
    ["Logo White URL", httpUrl(fields["Logo White URL"])],
    ["Logo White", firstImageAttachment(fields["Logo White"])],
  ]);
}

export type AirtableRecord = { id: string; fields: Record<string, unknown> };

export async function fetchAirtableSponsors(input: {
  token: string;
  baseId: string;
  table: string;
}): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | null = null;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    const url = `https://api.airtable.com/v0/${input.baseId}/${encodeURIComponent(input.table)}?${params}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${input.token}` },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Airtable ${response.status}: ${body.slice(0, 400)}`);
    }
    const data = (await response.json()) as { records?: AirtableRecord[]; offset?: string };
    all.push(...(data.records ?? []));
    offset = data.offset ?? null;
  } while (offset);
  return all;
}

export function mapAirtableSponsor(
  rec: AirtableRecord,
  eventCode: string,
): {
  airtableId: string;
  name: string;
  tier: string;
  boothNumber: string;
  colorLogoUrl: string;
  whiteLogoUrl: string;
} {
  const f = rec.fields;
  const name = String(f.Name ?? f.name ?? "Untitled sponsor");
  const eventVal = eventCode ? f[eventCode] : undefined;
  const tierRaw = Array.isArray(eventVal) ? eventVal[0] : eventVal;
  const tier = tierRaw != null ? String(tierRaw) : String(f.Tier ?? f.tier ?? "");
  const booth =
    f["Booth Number"] ??
    f["Booth"] ??
    f["Booth #"] ??
    f.booth_number ??
    f.BoothNumber ??
    "";
  return {
    airtableId: rec.id,
    name,
    tier,
    boothNumber: booth != null ? String(booth) : "",
    colorLogoUrl: resolveColorLogoSource(f).url,
    whiteLogoUrl: resolveWhiteLogoSource(f).url,
  };
}
