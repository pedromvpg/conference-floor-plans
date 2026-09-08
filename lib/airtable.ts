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

export type AirtableRecord = { id: string; fields: Record<string, unknown> };

export async function fetchAirtableTable(input: {
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

export const fetchAirtableSponsors = fetchAirtableTable;

/** Airtable table name — same as conference-screens; no tbl id required. */
export const AIRTABLE_SPONSORS_TABLE = "Sponsors";

export function mapAirtableSponsor(
  rec: AirtableRecord,
  eventCode: string,
): {
  airtableId: string;
  name: string;
  tier: string;
  boothNumber: string;
  colorLogoUrl: string;
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
  };
}

function firstString(fields: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = fields[key];
    if (v == null || v === "") continue;
    if (Array.isArray(v)) {
      const first = v[0];
      if (first == null) continue;
      if (typeof first === "string") return first;
      if (typeof first === "object" && first && "url" in first) return String((first as { url?: string }).url ?? "");
      return String(first);
    }
    return String(v);
  }
  return "";
}

function linkedIds(fields: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const v = fields[key];
    if (Array.isArray(v) && v.length && v.every((x) => typeof x === "string")) {
      return v as string[];
    }
  }
  return [];
}

function asUnix(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value / 1000 : value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n > 1e12 ? n / 1000 : n;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed / 1000;
  }
  return null;
}

const TEST_EVENT_RE = /test/i;
const AUTOMATION_RE = /automat/i;

export function mapAirtableSession(rec: AirtableRecord): {
  airtableId: string;
  title: string;
  stage: string;
  startUnix: number | null;
  endUnix: number | null;
  speakerIds: string[];
  sessionType: string;
} | null {
  const f = rec.fields;
  const title = firstString(f, ["Title", "Session Name", "Name"]);
  if (TEST_EVENT_RE.test(title) && AUTOMATION_RE.test(title)) return null;
  const startUnix =
    asUnix(f["Unix Time"] ?? f.unix_time) ??
    asUnix(f["⚙️ Start Time"] ?? f["Start Time (Time Only)"]);
  const endUnix =
    asUnix(f["End Time (ISO8601)"]) ??
    asUnix(f["⚙️ End Time"] ?? f["End Time (Time Only)"]);
  return {
    airtableId: rec.id,
    title,
    stage: firstString(f, ["Stage - Website Text", "Stage", "⚙️ Stage", "stage", "Track"]),
    startUnix,
    endUnix,
    speakerIds: linkedIds(f, ["⚙️ Speakers", "Speakers"]),
    sessionType: firstString(f, ["Type of Session", "Session Type", "Type"]),
  };
}

export function resolveHeadshotSource(fields: Record<string, unknown>): string {
  return (
    firstImageAttachment(fields.Headshot) ||
    firstImageAttachment(fields.Photo) ||
    httpUrl(fields["Headshot image URL"]) ||
    httpUrl(fields["Headshot image (from Website)"]) ||
    httpUrl(fields["Headshot - Full Res URL"]) ||
    httpUrl(fields["Headshot - Stylized - image URL"])
  );
}

export function mapAirtableSpeaker(rec: AirtableRecord): {
  airtableId: string;
  name: string;
  photoSourceUrl: string;
} {
  const f = rec.fields;
  return {
    airtableId: rec.id,
    name: firstString(f, ["Full Name", "Name"]) || "Untitled speaker",
    photoSourceUrl: resolveHeadshotSource(f),
  };
}
