import sharp from "sharp";
import type { Store } from "./store";

const MAX_EDGE = 512;

export async function cacheLogo(opts: {
  store: Store;
  eventId: string;
  airtableId: string;
  kind: "color" | "white";
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
      .png()
      .toBuffer();
    ext = "png";
    contentType = "image/png";
  }
  const path = `logos/${opts.eventId}/${opts.airtableId}${opts.kind === "white" ? "-w" : ""}.${ext}`;
  return opts.store.putFile(path, out, contentType);
}
