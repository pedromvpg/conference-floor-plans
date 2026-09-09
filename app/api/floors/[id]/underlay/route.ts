import sharp from "sharp";
import { getStore } from "@/lib/get-store";
import { requireEditor } from "@/lib/auth";
import { newId } from "@/lib/store";
import { calibrationFromPrimary, primaryFloor } from "@/lib/floor-settings";

type Ctx = { params: Promise<{ id: string }> };

function svgSize(svg: string): { w: number; h: number } | null {
  const vb = svg.match(/viewBox=["']([\d.\s-]+)["']/i);
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/).map(Number);
    if (p.length === 4 && p[2] > 0 && p[3] > 0) return { w: p[2], h: p[3] };
  }
  const w = svg.match(/\bwidth=["']([\d.]+)/i);
  const h = svg.match(/\bheight=["']([\d.]+)/i);
  if (w && h) return { w: Number(w[1]), h: Number(h[1]) };
  return null;
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    await requireEditor();
    const { id } = await ctx.params;
    const store = getStore();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "file required" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const type = file.type || "application/octet-stream";
    const origPath = `originals/${id}/${newId()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const originalUrl = await store.putFile(origPath, buf, type);

    let underlayBuf = buf;
    let underlayType = type;
    let widthPx = 0;
    let heightPx = 0;
    let ext = "bin";

    if (type.includes("svg") || file.name.endsWith(".svg")) {
      const size = svgSize(buf.toString("utf8"));
      widthPx = size?.w ?? 1000;
      heightPx = size?.h ?? 1000;
      ext = "svg";
      underlayType = "image/svg+xml";
    } else {
      const img = sharp(buf);
      const meta = await img.metadata();
      widthPx = meta.width ?? 0;
      heightPx = meta.height ?? 0;
      if (type.includes("png")) {
        ext = "png";
      } else if (type.includes("webp")) {
        ext = "webp";
      } else {
        underlayBuf = await img.png().toBuffer();
        underlayType = "image/png";
        ext = "png";
      }
    }

    const underlayPath = `underlays/${id}/${newId()}.${ext}`;
    const underlayUrl = await store.putFile(underlayPath, underlayBuf, underlayType);

    const existing = await store.getFloor(id);
    if (!existing) return Response.json({ error: "Floor not found" }, { status: 404 });
    const siblings = await store.listFloors(existing.eventId);
    const primary = primaryFloor(siblings);
    const floor = await store.updateFloor(id, {
      underlayUrl,
      originalUrl,
      calibration: existing.calibration
        ? { ...existing.calibration, widthPx, heightPx }
        : calibrationFromPrimary(primary?.id === existing.id ? null : primary?.calibration, widthPx, heightPx),
    });
    return Response.json(floor);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    await requireEditor();
    const { id } = await ctx.params;
    const body = (await req.json()) as { svg?: string };
    const svg = typeof body.svg === "string" ? body.svg : "";
    if (!svg.includes("<svg")) {
      return Response.json({ error: "svg required" }, { status: 400 });
    }
    const store = getStore();
    const existing = await store.getFloor(id);
    if (!existing) return Response.json({ error: "Floor not found" }, { status: 404 });
    const size = svgSize(svg);
    const siblings = await store.listFloors(existing.eventId);
    const primary = primaryFloor(siblings);
    const inherited = primary && primary.id !== existing.id ? primary.calibration : null;
    const widthPx = size?.w ?? existing.calibration?.widthPx ?? inherited?.widthPx ?? 1000;
    const heightPx = size?.h ?? existing.calibration?.heightPx ?? inherited?.heightPx ?? 1000;
    const underlayUrl = await store.putFile(
      `underlays/${id}/${newId()}.svg`,
      Buffer.from(svg, "utf8"),
      "image/svg+xml",
    );
    const cal = existing.calibration;
    const floor = await store.updateFloor(id, {
      underlayUrl,
      calibration: cal
        ? { ...cal, widthPx, heightPx }
        : calibrationFromPrimary(inherited, widthPx, heightPx),
    });
    return Response.json(floor);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
