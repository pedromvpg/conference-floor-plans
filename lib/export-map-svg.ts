import { amenityLabel } from "./amenities";
import { pinIconSvgMarkup } from "./pin-icons";
import { objectShape, rectangleCorners, svgPathD } from "./bezier";
import { boothFillHex, darkenHex } from "./colors";
import { contrastingLabel, paintIsNone, paintToHex, parseShapePaint, resolvedIconPaint } from "./paint";
import { fitLabelInBox, svgCenteredTspans, worldTopLeftOfLocalBox } from "./label-layout";
import { ringBounds, ringCentroid, rotateRing, venueWorldRect } from "./geometry";
import { displayLogoUrl } from "./hall";
import {
  LAYER_ATTR,
  NAME_ATTR,
  PRIVATE_ATTR,
  isSvgUnderlay,
  svgViewBox,
} from "./svg-layers";
import { fetchVenueSvgMarkup } from "./venue-svg-load";
import type { Floor, LibraryAsset, MapObject, Sponsor } from "./types";
import { isMapPinObject, isPinObject, MAP_PIN_META } from "./types";

const NS = "http://www.w3.org/2000/svg";
const INK = "http://www.inkscape.org/namespaces/inkscape";

/** 1 SVG unit ≈ 1px in Figma ≈ 1mm on paper. 1:10 → 100 u/m; 1:100 → 10 u/m. */
const UNITS_PER_M_1_TO_10 = 100;
const UNITS_PER_M_1_TO_100 = 10;
const FIGMA_MAX_EDGE = 2500;

export function mapExportScale(worldW: number, worldH: number): { denom: 10 | 100; unitsPerMeter: number } {
  const long = Math.max(worldW, worldH, 1);
  if (long * UNITS_PER_M_1_TO_10 <= FIGMA_MAX_EDGE) {
    return { denom: 10, unitsPerMeter: UNITS_PER_M_1_TO_10 };
  }
  return { denom: 100, unitsPerMeter: UNITS_PER_M_1_TO_100 };
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layerId(name: string, fallback: string, used: Set<string>): string {
  let base = name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!base || /^\d/.test(base)) base = `layer-${fallback}`;
  base = base.slice(0, 80);
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function isHiddenEl(el: Element): boolean {
  const display = (el.getAttribute("display") || "").toLowerCase();
  if (display === "none") return true;
  const vis = (el.getAttribute("visibility") || "").toLowerCase();
  if (vis === "hidden" || vis === "collapse") return true;
  return /display\s*:\s*none/i.test(el.getAttribute("style") || "");
}

function isPrivateEl(el: Element): boolean {
  const v = (el.getAttribute(PRIVATE_ATTR) || "").toLowerCase();
  return v === "1" || v === "true";
}

function localName(el: Element): string {
  return el.tagName.toLowerCase().replace(/^svg:/, "");
}

function labelOf(el: Element): string {
  const custom = (el.getAttribute(NAME_ATTR) || "").trim();
  if (custom) return custom;
  const ink =
    el.getAttribute("inkscape:label") ||
    el.getAttributeNS(INK, "label") ||
    "";
  if (ink.trim()) return ink.trim();
  const aria = (el.getAttribute("aria-label") || "").trim();
  if (aria) return aria;
  const id = (el.getAttribute("id") || "").trim();
  if (id && !id.startsWith("layer-") && !/^cm-/.test(id)) return id;
  const tag = localName(el);
  if (tag === "text") {
    const t = (el.textContent || "").trim().replace(/\s+/g, " ");
    if (t) return t.slice(0, 40);
  }
  return tag;
}

function markLayer(el: Element, used: Set<string>) {
  const name = labelOf(el);
  const id = layerId(name, el.getAttribute(LAYER_ATTR) || crypto.randomUUID().slice(0, 8), used);
  el.setAttribute("id", id);
  el.setAttribute("inkscape:label", name);
  if (localName(el) === "g" || localName(el) === "a" || localName(el) === "svg") {
    el.setAttribute("inkscape:groupmode", "layer");
  }
  const drop = [
    LAYER_ATTR,
    NAME_ATTR,
    PRIVATE_ATTR,
    "data-cm-locked",
    "data-cm-tx",
    "data-cm-ty",
    "data-cm-rot",
    "data-cm-rcx",
    "data-cm-rcy",
    "data-cm-tf",
    "data-cm-selected",
    "data-cm-hover",
    "pointer-events",
  ];
  for (const a of drop) el.removeAttribute(a);
}

function prepareVenueRoot(markup: string): SVGSVGElement | null {
  try {
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || localName(root) !== "svg" || root.querySelector("parsererror")) return null;
    root.setAttribute("xmlns:inkscape", INK);
    const used = new Set<string>();
    const walk = (el: Element) => {
      for (const child of [...el.children]) {
        if (isHiddenEl(child) || isPrivateEl(child)) {
          child.remove();
          continue;
        }
        const tag = localName(child);
        if (tag === "style" && child.getAttribute("id") === "cm-hide-private") {
          child.remove();
          continue;
        }
        if (tag === "script") {
          child.remove();
          continue;
        }
        markLayer(child, used);
        walk(child);
      }
    };
    walk(root);
    return root as unknown as SVGSVGElement;
  } catch {
    return null;
  }
}

function venueInner(root: SVGSVGElement): string {
  return [...root.childNodes].map((n) => new XMLSerializer().serializeToString(n)).join("");
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");
}

function objectTitle(o: MapObject, sponsor?: Sponsor): string {
  return (
    sponsor?.name ||
    o.name ||
    o.boothNumber ||
    (isMapPinObject(o) ? MAP_PIN_META[o.kind].label : amenityLabel(o.amenityType ?? "info"))
  );
}

function boothRectMarkup(o: MapObject, S: number): string | null {
  const nodes = objectShape(o);
  const corners = rectangleCorners(nodes);
  if (!corners) return null;
  const facing = o.facingDeg ?? 0;
  const c = ringCentroid(o.polygon!);
  const local = rotateRing(
    corners.map((n) => [n.x, n.y] as [number, number]),
    -facing,
  );
  const b = ringBounds(local);
  const axis =
    Math.abs(facing % 90) < 0.4 ||
    corners.every((n, i) => {
      const m = corners[(i + 1) % 4];
      return Math.abs(n.x - m.x) < 1e-3 || Math.abs(n.y - m.y) < 1e-3;
    });
  if (axis && Math.abs(facing % 90) < 0.4) {
    const wb = ringBounds(o.polygon!);
    return `<rect x="${num(wb.minX * S)}" y="${num(wb.minY * S)}" width="${num(wb.w * S)}" height="${num(wb.h * S)}"`;
  }
  return `<rect x="${num(b.minX * S)}" y="${num(b.minY * S)}" width="${num(b.w * S)}" height="${num(b.h * S)}" transform="rotate(${num(facing)} ${num(c.x * S)} ${num(c.y * S)})"`;
}

export type FloorPlanExportInput = {
  floor: Floor;
  objects: MapObject[];
  sponsors: Sponsor[];
  assets?: LibraryAsset[];
  venueSvg?: string | null;
  name?: string;
};

export function buildFloorPlanSvg(input: FloorPlanExportInput): string {
  const { floor, objects, sponsors, assets = [], venueSvg, name } = input;
  const used = new Set<string>();
  const bySponsor = new Map(sponsors.map((s) => [s.id, s]));
  const cal = floor.calibration;
  const venue = cal ? venueWorldRect(cal) : null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  if (venue) {
    grow(venue.minX, venue.minY);
    grow(venue.maxX, venue.maxY);
  }
  for (const o of objects) {
    if (o.polygon?.length) {
      const b = ringBounds(o.polygon);
      grow(b.minX, b.minY);
      grow(b.maxX, b.maxY);
    } else if (o.x != null && o.y != null) {
      grow(o.x - 1, o.y - 1);
      grow(o.x + 1, o.y + 1);
    }
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 40;
    maxY = 40;
  }
  const pad = 2;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;

  const { denom, unitsPerMeter: S } = mapExportScale(maxX - minX, maxY - minY);
  const sw = Math.max(0.4, 1.5 * (S / 100));

  const parts: string[] = [];
  const venueRoot = venueSvg ? prepareVenueRoot(venueSvg) : null;
  const vb = venueSvg ? svgViewBox(venueSvg) : null;
  if (venueRoot && vb && venue) {
    const inner = venueInner(venueRoot);
    const sx = (venue.w / vb.w) * S;
    const sy = (venue.h / vb.h) * S;
    const id = layerId("Venue", "venue", used);
    parts.push(
      `<g id="${id}" inkscape:groupmode="layer" inkscape:label="Venue" transform="translate(${num(venue.minX * S)} ${num(venue.minY * S)}) scale(${num(sx)} ${num(sy)}) translate(${num(-vb.x)} ${num(-vb.y)})">${inner}</g>`,
    );
  } else if (floor.underlayUrl && !isSvgUnderlay(floor.underlayUrl) && venue) {
    const id = layerId("Venue image", "venue-image", used);
    parts.push(
      `<g id="${id}" inkscape:groupmode="layer" inkscape:label="Venue image"><image href="${xmlEscape(floor.underlayUrl)}" x="${num(venue.minX * S)}" y="${num(venue.minY * S)}" width="${num(venue.w * S)}" height="${num(venue.h * S)}" preserveAspectRatio="none"/></g>`,
    );
  }

  const plots = objects.filter((o) => !isPinObject(o) && o.polygon?.length);
  const pins = objects.filter((o) => isPinObject(o) && o.x != null && o.y != null);
  const stages = plots.filter((o) => /\bstage\b/i.test(`${o.name} ${o.boothNumber}`) || o.appearance === "stage");
  const booths = plots.filter((o) => !stages.includes(o));

  function plotGroup(label: string, list: MapObject[]): string {
    const gid = layerId(label, label.toLowerCase(), used);
    const kids = list.map((o) => {
      const sponsor = o.sponsorId ? bySponsor.get(o.sponsorId) : undefined;
      const title = objectTitle(o, sponsor);
      const oid = layerId(title, o.id.slice(0, 8), used);
      const paint = parseShapePaint(o.paint);
      const fillOverride = paint.fill ?? o.color;
      const fillOff = paintIsNone(fillOverride);
      const fill = fillOff
        ? "none"
        : fillOverride && /^#|^rgb|^hsl/i.test(fillOverride)
          ? paintToHex(fillOverride, "#ecece8")
          : boothFillHex(o.color, sponsor?.tier ?? "", "light", label === "Stages" ? "stage" : "booth");
      const stroke = fill === "none" ? "#9a9a92" : darkenHex(fill, 0.45);
      const b = ringBounds(o.polygon!);
      const c = ringCentroid(o.polygon!);
      const rectOpen = boothRectMarkup(o, S);
      const shape = rectOpen
        ? `${rectOpen} fill="${fill}" stroke="${stroke}" stroke-width="${num(sw)}"/>`
        : `<path d="${svgPathD(
            objectShape(o).map((n) => ({
              ...n,
              x: n.x * S,
              y: n.y * S,
              inDx: n.inDx * S,
              inDy: n.inDy * S,
              outDx: n.outDx * S,
              outDy: n.outDy * S,
            })),
            true,
          )}" fill="${fill}" stroke="${stroke}" stroke-width="${num(sw)}"/>`;
      const nameLabel = (sponsor?.name || o.name || "").trim();
      const boothLabel = (o.boothNumber || sponsor?.boothNumber || "").trim();
      const fs = Math.max(S * 0.08, Math.min(b.w, b.h) * S * 0.16);
      const ink = fill === "none" ? "#1a1a1a" : contrastingLabel(fill, paint.fillOpacity, "light");
      const boxW = b.w * S * 0.88;
      const texts: string[] = [];
      if (nameLabel && nameLabel !== boothLabel) {
        const fitted = fitLabelInBox(nameLabel, boxW, b.h * 0.78 * S, fs);
        const x = num(c.x * S);
        const y = num(c.y * S);
        texts.push(
          `<text id="${layerId(`${title} name`, `${o.id}-name`, used)}" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="Inter, system-ui, sans-serif" font-size="${num(fitted.fontSize)}" font-weight="700" fill="${ink}">${svgCenteredTspans(x, y, fitted.fontSize, fitted.lines, xmlEscape)}</text>`,
        );
      }
      if (boothLabel) {
        const facing = o.facingDeg ?? 0;
        const local = rotateRing(o.polygon!, -facing);
        const lb = ringBounds(local);
        const pos = worldTopLeftOfLocalBox(c.x, c.y, facing, lb, 0.08);
        texts.push(
          `<text id="${layerId(`${title} number`, `${o.id}-num`, used)}" x="${num(pos.x * S)}" y="${num(pos.y * S)}" text-anchor="start" dominant-baseline="hanging" font-family="ui-monospace, monospace" font-size="8" fill="${ink}">${xmlEscape(boothLabel)}</text>`,
        );
      }
      const logoUrl = displayLogoUrl(o, assets, sponsor);
      const logo = logoUrl
        ? `<image href="${xmlEscape(logoUrl)}" x="${num((b.minX + b.w * 0.12) * S)}" y="${num((b.minY + b.h * 0.1) * S)}" width="${num(b.w * 0.76 * S)}" height="${num(b.h * 0.42 * S)}" preserveAspectRatio="xMidYMid meet"/>`
        : "";
      return `<g id="${oid}" inkscape:label="${xmlEscape(title)}">${shape}${logo}${texts.join("")}</g>`;
    });
    return `<g id="${gid}" inkscape:groupmode="layer" inkscape:label="${xmlEscape(label)}">${kids.join("")}</g>`;
  }

  if (stages.length) parts.push(plotGroup("Stages", stages));
  if (booths.length) parts.push(plotGroup("Booths", booths));
  if (pins.length) {
    const gid = layerId("Icons", "icons", used);
    const kids = pins.map((o) => {
      const look = resolvedIconPaint(o.paint, o.color, "light");
      const title = objectTitle(o);
      const oid = layerId(title, o.id.slice(0, 8), used);
      const r = 0.55 * S;
      const glyph = pinIconSvgMarkup(o.kind, o.amenityType, o.x! * S, o.y! * S, r * 1.35, look.glyphHex);
      const fill = look.fillNone ? "none" : look.fillHex;
      const stroke = look.strokeNone ? "none" : look.strokeHex;
      const sw = look.strokeNone ? 0 : Math.max(look.strokeWidth, 0) * S;
      return `<g id="${oid}" inkscape:label="${xmlEscape(title)}" opacity="${num(look.opacity)}"><circle cx="${num(o.x! * S)}" cy="${num(o.y! * S)}" r="${num(r)}" fill="${fill}" fill-opacity="${num(look.fillOpacity)}" stroke="${stroke}" stroke-opacity="${num(look.strokeOpacity)}" stroke-width="${num(sw)}"/>${glyph}</g>`;
    });
    parts.push(`<g id="${gid}" inkscape:groupmode="layer" inkscape:label="Icons">${kids.join("")}</g>`);
  }

  const w = (maxX - minX) * S;
  const h = (maxY - minY) * S;
  const title = xmlEscape(name || floor.name || "Floor plan");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="${NS}" xmlns:inkscape="${INK}" viewBox="${num(minX * S)} ${num(minY * S)} ${num(w)} ${num(h)}" width="${num(w)}" height="${num(h)}" fill="none" data-map-scale="1:${denom}" data-meters-per-unit="${num(1 / S)}">
  <title>${title} (1:${denom})</title>
  ${parts.join("\n  ")}
</svg>`;
}

export function downloadSvgFile(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** SVG 1.1 + XML header — Illustrator opens this reliably via File → Open / Place. */
export function svgForIllustrator(svg: string): string {
  let out = svg.trim();
  if (!out.startsWith("<?xml")) out = `<?xml version="1.0" encoding="UTF-8"?>\n${out}`;
  out = out.replace(/<svg\b([^>]*)>/, (_, attrs: string) => {
    let a = attrs;
    if (!/\bxmlns:xlink=/.test(a)) a += ` xmlns:xlink="http://www.w3.org/1999/xlink"`;
    if (!/\bversion=/.test(a)) a += ` version="1.1"`;
    if (!/\bxml:space=/.test(a)) a += ` xml:space="preserve"`;
    return `<svg${a}>`;
  });
  return out;
}

export async function copySvgForFigma(svg: string): Promise<void> {
  const html = `<!DOCTYPE html><html><body>${svg.replace(/^<\?xml[^>]*>\s*/i, "")}</body></html>`;
  const plain = new Blob([svg], { type: "text/plain" });
  const htmlBlob = new Blob([html], { type: "text/html" });
  const svgBlob = new Blob([svg], { type: "image/svg+xml" });
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/svg+xml": svgBlob,
        "text/plain": plain,
        "text/html": htmlBlob,
      }),
    ]);
    return;
  } catch {
    /* browsers often reject image/svg+xml */
  }
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": plain,
        "text/html": htmlBlob,
      }),
    ]);
    return;
  } catch {
    await navigator.clipboard.writeText(svg);
  }
}

/** Plain SVG XML only — HTML clipboard (used for Figma) pastes as junk in Illustrator. */
export async function copySvgForIllustrator(svg: string): Promise<void> {
  const ai = svgForIllustrator(svg);
  const plain = new Blob([ai], { type: "text/plain" });
  const svgBlob = new Blob([ai], { type: "image/svg+xml" });
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/svg+xml": svgBlob,
        "text/plain": plain,
      }),
    ]);
    return;
  } catch {
    /* browsers often reject image/svg+xml */
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": plain })]);
  } catch {
    await navigator.clipboard.writeText(ai);
  }
}

export async function loadVenueSvgMarkup(floor: Floor, live?: string | null): Promise<string | null> {
  if (live) return live;
  return fetchVenueSvgMarkup(floor.underlayUrl);
}
