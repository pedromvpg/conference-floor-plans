import sharp from "sharp";
import type { Store } from "./store";

const MAX_EDGE = 1000;

export async function cacheHeadshot(opts: {
  store: Store;
  eventId: string;
  airtableId: string;
  sourceUrl: string;
}): Promise<string> {
  if (!opts.sourceUrl) return "";
  const res = await fetch(opts.sourceUrl);
  if (!res.ok) return "";
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") || "";
  const isSvg = type.includes("svg") || opts.sourceUrl.includes(".svg");
  let out: Buffer;
  let ext: string;
  let contentType: string;
  if (isSvg) {
    out = buf;
    ext = "svg";
    contentType = "image/svg+xml";
  } else {
    out = await sharp(buf)
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    ext = "jpg";
    contentType = "image/jpeg";
  }
  const path = `headshots/${opts.eventId}/${opts.airtableId}.${ext}`;
  return opts.store.putFile(path, out, contentType);
}
