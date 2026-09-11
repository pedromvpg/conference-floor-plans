import {
  corner,
  fromRing,
  isRectangleShape,
  moveNode,
  parseSvgPath,
  resizeRectangleCorner,
  svgPathD,
  tessellate,
  type BezierNode,
} from "./bezier";
import { metersFromPixels } from "./geometry";
import type { Calibration, Ring } from "./types";

const LAYER_ATTR = "data-cm-layer";
const NAME_ATTR = "data-cm-name";
const LOCK_ATTR = "data-cm-locked";
const PRIVATE_ATTR = "data-cm-private";
const PRIVATE_STYLE_ID = "cm-hide-private";
const PRIVATE_STYLE_CSS = `[${PRIVATE_ATTR}="1"]{display:none!important}`;
const TX_ATTR = "data-cm-tx";
const TY_ATTR = "data-cm-ty";
const ROT_ATTR = "data-cm-rot";
const RCX_ATTR = "data-cm-rcx";
const RCY_ATTR = "data-cm-rcy";
const TF_ATTR = "data-cm-tf";

const SKIP = new Set([
  "defs",
  "title",
  "desc",
  "metadata",
  "style",
  "script",
  "clippath",
  "mask",
  "lineargradient",
  "radialgradient",
  "pattern",
  "filter",
  "marker",
  "symbol",
  "font",
  "font-face",
]);

const GRAPHIC = new Set([
  "g",
  "a",
  "path",
  "polygon",
  "polyline",
  "rect",
  "circle",
  "ellipse",
  "line",
  "text",
  "image",
  "use",
]);

export type SvgTextWeight = "regular" | "bold" | "black";
export type SvgTextAlign = "left" | "center" | "right";

const TEXT_LINE_EM = 0.95;
const TEXT_CHAR_W = 0.62;

export type SvgLayer = {
  id: string;
  name: string;
  kind: string;
  hidden: boolean;
  locked: boolean;
  private: boolean;
  text: string | null;
  fontSize: number | null;
  fontWeight: SvgTextWeight | null;
  textAlign: SvgTextAlign | null;
  opacity: number;
  children: SvgLayer[];
};

export function isSvgUnderlay(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0].toLowerCase();
  return path.endsWith(".svg");
}

export function isRasterUnderlay(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = url.split("?")[0].toLowerCase();
  return /\.(png|jpe?g|webp)$/.test(path);
}

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function blankVenueSvg(widthPx: number, heightPx: number): string {
  const w = Math.max(1, widthPx);
  const h = Math.max(1, heightPx);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"></svg>`;
}

export function wrapRasterAsSvg(href: string, widthPx: number, heightPx: number): string {
  const w = Math.max(1, widthPx);
  const h = Math.max(1, heightPx);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><image href="${escapeXmlAttr(href)}" width="${w}" height="${h}" preserveAspectRatio="none"/></svg>`;
}

const SHAPE_STROKE = "#1a1a1a";
const SHAPE_FILL = "#f4f0e6";

export function appendSvgRect(markup: string, x: number, y: number, w: number, h: number): string {
  const root = parseRoot(markup);
  const el = root.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "rect");
  el.setAttribute("x", String(x));
  el.setAttribute("y", String(y));
  el.setAttribute("width", String(w));
  el.setAttribute("height", String(h));
  el.setAttribute("fill", SHAPE_FILL);
  el.setAttribute("stroke", SHAPE_STROKE);
  el.setAttribute("stroke-width", "2");
  root.appendChild(el);
  ensureLayerIds(root);
  return new XMLSerializer().serializeToString(root);
}

export function appendSvgEllipse(markup: string, cx: number, cy: number, rx: number, ry: number): string {
  const root = parseRoot(markup);
  const el = root.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  el.setAttribute("cx", String(cx));
  el.setAttribute("cy", String(cy));
  el.setAttribute("rx", String(Math.max(1, rx)));
  el.setAttribute("ry", String(Math.max(1, ry)));
  el.setAttribute("fill", SHAPE_FILL);
  el.setAttribute("stroke", SHAPE_STROKE);
  el.setAttribute("stroke-width", "2");
  root.appendChild(el);
  ensureLayerIds(root);
  return new XMLSerializer().serializeToString(root);
}

export function lastSvgLayerId(markup: string): string | null {
  const layers = listSvgLayers(markup);
  return layers[0]?.id ?? null;
}

export function appendSvgPolygon(markup: string, points: SvgPoint[]): string {
  if (points.length < 3) return markup;
  const root = parseRoot(markup);
  const el = root.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute(
    "d",
    `${points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join("")}Z`,
  );
  el.setAttribute("fill", SHAPE_FILL);
  el.setAttribute("stroke", SHAPE_STROKE);
  el.setAttribute("stroke-width", "2");
  root.appendChild(el);
  ensureLayerIds(root);
  return new XMLSerializer().serializeToString(root);
}

export function appendSvgBezier(markup: string, nodes: BezierNode[], closed = true): string {
  if (nodes.length < 2) return markup;
  const root = parseRoot(markup);
  const el = root.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("d", svgPathD(nodes, closed));
  el.setAttribute("fill", closed ? SHAPE_FILL : "none");
  el.setAttribute("stroke", SHAPE_STROKE);
  el.setAttribute("stroke-width", "2");
  el.setAttribute("stroke-linecap", "round");
  el.setAttribute("stroke-linejoin", "round");
  root.appendChild(el);
  ensureLayerIds(root);
  return new XMLSerializer().serializeToString(root);
}

export function appendSvgText(markup: string, x: number, y: number, text = "Label", fontSize?: number): string {
  const root = parseRoot(markup);
  const vb = svgViewBox(markup);
  const fs = fontSize ?? Math.max(12, Math.min(vb?.w ?? 1000, vb?.h ?? 1000) * 0.035);
  const el = root.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "text");
  el.setAttribute("x", String(x));
  el.setAttribute("y", String(y));
  el.setAttribute("fill", SHAPE_STROKE);
  el.setAttribute("font-size", String(fs));
  el.setAttribute("font-family", "system-ui, sans-serif");
  el.setAttribute("font-weight", weightAttr("bold"));
  el.setAttribute("text-anchor", anchorFromAlign("center"));
  el.setAttribute("dominant-baseline", "middle");
  el.setAttribute(NAME_ATTR, text);
  writeTextLines(el, text);
  root.appendChild(el);
  ensureLayerIds(root);
  return new XMLSerializer().serializeToString(root);
}

export function appendSvgImage(markup: string, href: string, x: number, y: number, w: number, h: number): string {
  const root = parseRoot(markup);
  const el = root.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "image");
  el.setAttribute("href", href);
  el.setAttribute("x", String(x));
  el.setAttribute("y", String(y));
  el.setAttribute("width", String(Math.max(1, w)));
  el.setAttribute("height", String(Math.max(1, h)));
  el.setAttribute("preserveAspectRatio", "xMidYMid meet");
  root.appendChild(el);
  ensureLayerIds(root);
  return new XMLSerializer().serializeToString(root);
}

export function extractClipboardPathD(text: string): string | null {
  const t = text.trim();
  if (!t || t.startsWith("<")) return null;
  const quoted = t.match(/^(?:d\s*=\s*)?(["'])([\s\S]*?)\1\s*$/i);
  if (quoted?.[2]?.trim() && /^[Mm]/.test(quoted[2].trim())) return quoted[2].trim();
  const attr = t.match(/\bd\s*=\s*(["'])([\s\S]*?)\1/);
  if (attr?.[2]?.trim() && /^[Mm]/.test(attr[2].trim())) return attr[2].trim();
  if (/^[Mm]([\s,]|[-+0-9])/.test(t)) return t;
  return null;
}

export function clipboardLooksLikeSvg(text: string): boolean {
  if (!text.trim()) return false;
  if (extractClipboardPathD(text)) return true;
  return /<svg[\s>]/i.test(text) || /<path[\s>]/i.test(text);
}

function wrapSvgFragment(text: string): string {
  const t = text.trim();
  const svg = t.match(/<svg[\s\S]*?<\/svg>/i);
  if (svg) return svg[0];
  return `<svg xmlns="http://www.w3.org/2000/svg">${t}</svg>`;
}

export function pastedSvgPaths(pasted: string): { nodes: BezierNode[]; closed: boolean }[] {
  const d = extractClipboardPathD(pasted);
  if (d) {
    const parsed = parseSvgPath(d);
    return parsed && parsed.nodes.length >= 2 ? [parsed] : [];
  }
  if (!/<[a-z]/i.test(pasted)) return [];
  try {
    const guest = parseRoot(wrapSvgFragment(pasted));
    const out: { nodes: BezierNode[]; closed: boolean }[] = [];
    for (const el of guest.querySelectorAll("path")) {
      const parsed = parseSvgPath(el.getAttribute("d") || "");
      if (parsed && parsed.nodes.length >= 2) out.push(parsed);
    }
    return out;
  } catch {
    return [];
  }
}

export function appendPastedSvg(hostMarkup: string, pasted: string): { markup: string; ids: string[] } | null {
  const d = extractClipboardPathD(pasted);
  if (d) {
    const parsed = parseSvgPath(d);
    if (!parsed || parsed.nodes.length < 2) return null;
    const markup = appendSvgBezier(hostMarkup, parsed.nodes, parsed.closed);
    const id = lastSvgLayerId(markup);
    return id ? { markup, ids: [id] } : null;
  }
  if (!/<[a-z]/i.test(pasted)) return null;
  try {
    const guest = parseRoot(wrapSvgFragment(pasted));
    const kids = graphicChildren(guest);
    if (!kids.length) {
      const paths = pastedSvgPaths(pasted);
      if (!paths.length) return null;
      let markup = hostMarkup;
      const ids: string[] = [];
      for (const parsed of paths) {
        markup = appendSvgBezier(markup, parsed.nodes, parsed.closed);
        const id = lastSvgLayerId(markup);
        if (id) ids.push(id);
      }
      return ids.length ? { markup, ids } : null;
    }
    const before = new Set(listSvgLayers(hostMarkup).map((l) => l.id));
    const host = parseRoot(hostMarkup);
    const doc = host.ownerDocument;
    for (const kid of kids) {
      host.appendChild(doc.importNode(kid, true));
    }
    ensureLayerIds(host);
    const markup = new XMLSerializer().serializeToString(host);
    const ids = listSvgLayers(markup)
      .map((l) => l.id)
      .filter((id) => !before.has(id));
    return ids.length ? { markup, ids } : null;
  } catch {
    return null;
  }
}

function localName(el: Element): string {
  return el.tagName.toLowerCase().replace(/^svg:/, "");
}

function parseRoot(markup: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || localName(root) !== "svg" || root.querySelector("parsererror")) {
    throw new Error("Not a valid SVG drawing");
  }
  ensureLayerIds(root as unknown as SVGSVGElement);
  return root as unknown as SVGSVGElement;
}

function graphicChildren(el: Element): Element[] {
  return [...el.children].filter((child) => {
    const name = localName(child);
    if (SKIP.has(name) || name === "tspan") return false;
    return GRAPHIC.has(name) || name === "svg";
  });
}

function isLocked(el: Element): boolean {
  const v = (el.getAttribute(LOCK_ATTR) || "").toLowerCase();
  return v === "1" || v === "true";
}

function isPrivate(el: Element): boolean {
  const v = (el.getAttribute(PRIVATE_ATTR) || "").toLowerCase();
  return v === "1" || v === "true";
}

function isHidden(el: Element): boolean {
  const display = (el.getAttribute("display") || "").toLowerCase();
  if (display === "none") return true;
  const vis = (el.getAttribute("visibility") || "").toLowerCase();
  if (vis === "hidden" || vis === "collapse") return true;
  const style = el.getAttribute("style") || "";
  return /display\s*:\s*none/i.test(style);
}

function layerName(el: Element, index: number): string {
  const custom = (el.getAttribute(NAME_ATTR) || "").trim();
  if (custom) return custom;
  const ink =
    el.getAttribute("inkscape:label") ||
    el.getAttributeNS("http://www.inkscape.org/namespaces/inkscape", "label");
  const label = ink || el.getAttribute("aria-label") || el.getAttribute("id");
  if (label && !label.startsWith("layer-") && !/^cm-/.test(label)) return label;
  const tag = localName(el);
  if (tag === "g") return `Group ${index + 1}`;
  if (tag === "image") return `Image ${index + 1}`;
  if (tag === "path") return `Path ${index + 1}`;
  if (tag === "polygon") return `Polygon ${index + 1}`;
  if (tag === "polyline") return `Polyline ${index + 1}`;
  if (tag === "text") {
    const t = (el.textContent || "").trim().replace(/\s+/g, " ");
    if (t) return t.slice(0, 40);
    return `Label ${index + 1}`;
  }
  return `${tag} ${index + 1}`;
}

function collectNodes(root: Element, acc: Element[] = []): Element[] {
  for (const child of graphicChildren(root)) {
    acc.push(child);
    const name = localName(child);
    if (name === "g" || name === "a" || name === "svg") collectNodes(child, acc);
  }
  return acc;
}

function ensureLayerIds(root: SVGSVGElement) {
  const used = new Set<string>();
  collectNodes(root).forEach((el, i) => {
    let id = el.getAttribute(LAYER_ATTR) || el.getAttribute("id") || `cm-${i + 1}`;
    id = id.replace(/\s+/g, "-");
    let unique = id;
    let n = 2;
    while (used.has(unique)) {
      unique = `${id}-${n}`;
      n += 1;
    }
    used.add(unique);
    el.setAttribute(LAYER_ATTR, unique);
  });
}

function findLayer(root: SVGSVGElement, id: string): Element | undefined {
  return collectNodes(root).find((n) => n.getAttribute(LAYER_ATTR) === id);
}

function toLayer(el: Element, index: number): SvgLayer {
  const kind = localName(el);
  const kids = graphicChildren(el);
  return {
    id: el.getAttribute(LAYER_ATTR) || `cm-${index + 1}`,
    name: layerName(el, index),
    kind,
    hidden: isHidden(el),
    locked: isLocked(el),
    private: isPrivate(el),
    text: kind === "text" ? readTextLines(el) : null,
    fontSize: kind === "text" ? Number(el.getAttribute("font-size") || "") || null : null,
    fontWeight: kind === "text" ? weightFromAttr(el.getAttribute("font-weight")) : null,
    textAlign: kind === "text" ? alignFromAnchor(el.getAttribute("text-anchor")) : null,
    opacity: svgOpacityFromEl(el),
    children: [...kids].map((child, i) => toLayer(child, i)).reverse(),
  };
}

export function listSvgLayers(markup: string): SvgLayer[] {
  const root = parseRoot(markup);
  return graphicChildren(root)
    .map((el, i) => toLayer(el, i))
    .reverse();
}

export function flattenSvgLayers(layers: SvgLayer[]): SvgLayer[] {
  const out: SvgLayer[] = [];
  function walk(nodes: SvgLayer[]) {
    for (const n of nodes) {
      out.push(n);
      if (n.children.length) walk(n.children);
    }
  }
  walk(layers);
  return out;
}

export function findSvgLayer(layers: SvgLayer[], id: string): SvgLayer | null {
  for (const n of layers) {
    if (n.id === id) return n;
    const child = findSvgLayer(n.children, id);
    if (child) return child;
  }
  return null;
}

function svgToWorld(
  sx: number,
  sy: number,
  vb: { x: number; y: number; w: number; h: number },
  cal: Calibration,
): { x: number; y: number } {
  return metersFromPixels(
    ((sx - vb.x) / vb.w) * cal.widthPx,
    ((sy - vb.y) / vb.h) * cal.heightPx,
    cal,
  );
}

export function svgVenueWorldPolylines(markup: string, cal: Calibration): { points: Ring; closed: boolean }[] {
  try {
    const root = parseRoot(markup);
    const vb = viewBoxFromRoot(root);
    if (!vb || !(vb.w > 0) || !(vb.h > 0) || !(cal.widthPx > 0) || !(cal.heightPx > 0)) return [];
    const out: { points: Ring; closed: boolean }[] = [];
    for (const el of collectNodes(root)) {
      if (skippedForHall(el, root, vb)) continue;
      const local = elementPolyline(el);
      if (!local || local.points.length < 2) continue;
      out.push({
        closed: local.closed,
        points: local.points.map(([x, y]) => {
          const [sx, sy] = svgLocalToRoot(el, x, y);
          const p = svgToWorld(sx, sy, vb, cal);
          return [p.x, p.y];
        }),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export type SvgVenueWorldLabel = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  align: SvgTextAlign;
  weight: SvgTextWeight;
  rotation: number;
};

export function svgVenueWorldLabels(markup: string, cal: Calibration): SvgVenueWorldLabel[] {
  try {
    const root = parseRoot(markup);
    const vb = viewBoxFromRoot(root);
    if (!vb || !(vb.w > 0) || !(vb.h > 0) || !(cal.widthPx > 0) || !(cal.heightPx > 0)) return [];
    const out: SvgVenueWorldLabel[] = [];
    for (const el of collectNodes(root)) {
      if (localName(el) !== "text") continue;
      if (skippedForHall(el, root, vb, { allowText: true })) continue;
      const text = readTextLines(el).replace(/\s+$/g, "").replace(/^\s+/g, "");
      if (!text.trim()) continue;
      const lx = Number(el.getAttribute("x") || 0);
      const ly = Number(el.getAttribute("y") || 0);
      const [sx, sy] = svgLocalToRoot(el, lx, ly);
      const origin = svgToWorld(sx, sy, vb, cal);
      const [sx1, sy1] = svgLocalToRoot(el, lx + 1, ly);
      const along = svgToWorld(sx1, sy1, vb, cal);
      const fs = textFontSize(el);
      const [fsx, fsy] = svgLocalToRoot(el, lx, ly + fs);
      const fsWorld = svgToWorld(fsx, fsy, vb, cal);
      const fontSize = Math.hypot(fsWorld.x - origin.x, fsWorld.y - origin.y);
      if (!(fontSize > 0) || !Number.isFinite(origin.x + origin.y)) continue;
      out.push({
        text,
        x: origin.x,
        y: origin.y,
        fontSize,
        align: alignFromAnchor(el.getAttribute("text-anchor")),
        weight: weightFromAttr(el.getAttribute("font-weight")),
        rotation: Math.atan2(along.y - origin.y, along.x - origin.x),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function viewBoxFromRoot(root: SVGSVGElement): { x: number; y: number; w: number; h: number } | null {
  const vb = root.getAttribute("viewBox");
  if (vb) {
    const p = vb.trim().split(/[\s,]+/).map(Number);
    if (p.length === 4 && p[2] > 0 && p[3] > 0) return { x: p[0], y: p[1], w: p[2], h: p[3] };
  }
  const w = Number.parseFloat(root.getAttribute("width") || "");
  const h = Number.parseFloat(root.getAttribute("height") || "");
  if (w > 0 && h > 0) return { x: 0, y: 0, w, h };
  return null;
}

export function svgViewBox(markup: string): { x: number; y: number; w: number; h: number } | null {
  try {
    return viewBoxFromRoot(parseRoot(markup));
  } catch {
    return null;
  }
}

function applySvgTransform(t: string, x: number, y: number): [number, number] {
  if (!t.trim()) return [x, y];
  const cmds: Array<{ kind: "t"; x: number; y: number } | { kind: "r"; deg: number; cx: number; cy: number }> = [];
  const re =
    /translate\(\s*([-.\d]+)(?:[,\s]+|\s+)([-.\d]+)[^)]*\)|rotate\(\s*([-.\d]+)(?:(?:[,\s]+|\s+)([-.\d]+)(?:[,\s]+|\s+)([-.\d]+))?[^)]*\)/g;
  for (const m of t.matchAll(re)) {
    if (m[1] != null) cmds.push({ kind: "t", x: Number(m[1]), y: Number(m[2]) });
    else cmds.push({ kind: "r", deg: Number(m[3]), cx: Number(m[4] || 0), cy: Number(m[5] || 0) });
  }
  let cx = x;
  let cy = y;
  for (let i = cmds.length - 1; i >= 0; i--) {
    const cmd = cmds[i];
    if (cmd.kind === "t") {
      cx += cmd.x;
      cy += cmd.y;
    } else {
      const a = (cmd.deg * Math.PI) / 180;
      const dx = cx - cmd.cx;
      const dy = cy - cmd.cy;
      cx = cmd.cx + dx * Math.cos(a) - dy * Math.sin(a);
      cy = cmd.cy + dx * Math.sin(a) + dy * Math.cos(a);
    }
  }
  return [cx, cy];
}

function svgLocalToRoot(el: Element, x: number, y: number): [number, number] {
  let cx = x;
  let cy = y;
  let n: Element | null = el;
  while (n) {
    [cx, cy] = applySvgTransform(n.getAttribute("transform") || "", cx, cy);
    if (localName(n) === "svg") break;
    n = n.parentElement;
  }
  return [cx, cy];
}

function skippedForHall(
  el: Element,
  root: SVGSVGElement,
  vb: { x: number; y: number; w: number; h: number },
  opts?: { allowText?: boolean },
): boolean {
  const kind = localName(el);
  if (kind === "g" || kind === "a" || kind === "svg" || kind === "image" || kind === "use") {
    return true;
  }
  if (kind === "text" && !opts?.allowText) return true;
  let n: Element | null = el;
  while (n) {
    if (isHidden(n) || isPrivate(n)) return true;
    if (n === root) break;
    n = n.parentElement;
  }
  if (kind !== "rect") return false;
  const box = rectBox(el);
  const area = box.w * box.h;
  const va = vb.w * vb.h;
  return va > 0 && area / va > 0.82;
}

function elementPolyline(el: Element): { points: Ring; closed: boolean } | null {
  const kind = localName(el);
  if (kind === "line") {
    return {
      closed: false,
      points: [
        [Number(el.getAttribute("x1") || 0), Number(el.getAttribute("y1") || 0)],
        [Number(el.getAttribute("x2") || 0), Number(el.getAttribute("y2") || 0)],
      ],
    };
  }
  if (kind === "rect") {
    const b = rectBox(el);
    return {
      closed: true,
      points: [
        [b.x, b.y],
        [b.x + b.w, b.y],
        [b.x + b.w, b.y + b.h],
        [b.x, b.y + b.h],
      ],
    };
  }
  if (kind === "circle") {
    const cx = Number(el.getAttribute("cx") || 0);
    const cy = Number(el.getAttribute("cy") || 0);
    const r = Number(el.getAttribute("r") || 0);
    return { closed: true, points: ellipseRing(cx, cy, r, r) };
  }
  if (kind === "ellipse") {
    const cx = Number(el.getAttribute("cx") || 0);
    const cy = Number(el.getAttribute("cy") || 0);
    const rx = Number(el.getAttribute("rx") || 0);
    const ry = Number(el.getAttribute("ry") || 0);
    return { closed: true, points: ellipseRing(cx, cy, rx, ry) };
  }
  if (kind === "polygon" || kind === "polyline") {
    const pts = parsePoints(el.getAttribute("points") || "");
    if (pts.length < 2) return null;
    return { closed: kind === "polygon", points: pts.map((p) => [p.x, p.y]) };
  }
  if (kind === "path") {
    const d = el.getAttribute("d") || "";
    const parsed = parseSvgPath(d);
    if (parsed && parsed.nodes.length >= 2) {
      return { closed: parsed.closed, points: tessellate(parsed.nodes, parsed.closed) };
    }
    return samplePathD(d);
  }
  return null;
}

function ellipseRing(cx: number, cy: number, rx: number, ry: number, n = 48): Ring {
  const out: Ring = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return out;
}

function samplePathD(d: string): { points: Ring; closed: boolean } | null {
  if (!d.trim() || typeof document === "undefined") return null;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  const len = path.getTotalLength();
  if (!(len > 0)) return null;
  const n = Math.min(400, Math.max(8, Math.round(len / 6)));
  const points: Ring = [];
  for (let i = 0; i <= n; i++) {
    const p = path.getPointAtLength((i / n) * len);
    points.push([p.x, p.y]);
  }
  return { points, closed: /z\s*$/i.test(d.trim()) };
}

export function svgInnerMarkup(
  markup: string,
  opts?: { hoverId?: string | null; selectedId?: string | null; selectedIds?: string[] },
): string {
  const root = parseRoot(markup);
  root.querySelector(`#${PRIVATE_STYLE_ID}`)?.remove();
  const hoverId = opts?.hoverId ?? null;
  const selected = new Set(
    opts?.selectedIds?.length ? opts.selectedIds : opts?.selectedId ? [opts.selectedId] : [],
  );
  for (const el of collectNodes(root)) {
    const id = el.getAttribute(LAYER_ATTR);
    if (id && selected.has(id)) el.setAttribute("data-cm-selected", "1");
    else el.removeAttribute("data-cm-selected");
    if (id && id === hoverId) el.setAttribute("data-cm-hover", "1");
    else el.removeAttribute("data-cm-hover");
    if (id && isLocked(el)) el.setAttribute("pointer-events", "none");
  }
  return [...root.childNodes].map((n) => new XMLSerializer().serializeToString(n)).join("");
}

export function serializeSvg(markup: string): string {
  return new XMLSerializer().serializeToString(parseRoot(markup));
}

export function setSvgLayerHidden(markup: string, id: string, hidden: boolean): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  if (hidden) el.setAttribute("display", "none");
  else el.removeAttribute("display");
  return new XMLSerializer().serializeToString(root);
}

export function setSvgLayerPrivate(markup: string, id: string, nextPrivate: boolean): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  if (nextPrivate) el.setAttribute(PRIVATE_ATTR, "1");
  else el.removeAttribute(PRIVATE_ATTR);
  return new XMLSerializer().serializeToString(root);
}

/** DOM-free so the underlay PUT route can run this on the server. */
export function svgForPublishedUnderlay(markup: string): string {
  const stripped = markup.replace(
    new RegExp(`<style\\b[^>]*\\bid=["']${PRIVATE_STYLE_ID}["'][^>]*>[\\s\\S]*?<\\/style>`, "i"),
    "",
  );
  const open = stripped.match(/<svg\b[^>]*>/i);
  if (!open || open.index == null) throw new Error("Not a valid SVG drawing");
  const style = `<style id="${PRIVATE_STYLE_ID}">${PRIVATE_STYLE_CSS}</style>`;
  const at = open.index + open[0].length;
  return stripped.slice(0, at) + style + stripped.slice(at);
}

export function setSvgLayerLocked(markup: string, id: string, locked: boolean): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  if (locked) {
    el.setAttribute(LOCK_ATTR, "1");
    el.setAttribute("pointer-events", "none");
  } else {
    el.removeAttribute(LOCK_ATTR);
    if ((el.getAttribute("pointer-events") || "").toLowerCase() === "none") {
      el.removeAttribute("pointer-events");
    }
  }
  return new XMLSerializer().serializeToString(root);
}

export function deleteSvgLayer(markup: string, id: string): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  el.remove();
  return new XMLSerializer().serializeToString(root);
}

export function reorderSvgSiblings(markup: string, parentId: string | null, frontToBackIds: string[]): string {
  const root = parseRoot(markup);
  const parent = parentId ? findLayer(root, parentId) : root;
  if (!parent) return markup;
  const byId = new Map(graphicChildren(parent).map((el) => [el.getAttribute(LAYER_ATTR) || "", el]));
  for (const id of [...frontToBackIds].reverse()) {
    const el = byId.get(id);
    if (el) parent.appendChild(el);
  }
  return new XMLSerializer().serializeToString(root);
}

/** @deprecated sibling reorder at root; prefer reorderSvgSiblings */
export function reorderSvgLayers(markup: string, frontToBackIds: string[]): string {
  return reorderSvgSiblings(markup, null, frontToBackIds);
}

export function setSvgLayerName(markup: string, id: string, name: string): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  const trimmed = name.trim();
  if (trimmed) {
    el.setAttribute(NAME_ATTR, trimmed);
    el.setAttribute("aria-label", trimmed);
  } else {
    el.removeAttribute(NAME_ATTR);
  }
  return new XMLSerializer().serializeToString(root);
}

export function groupSvgLayers(
  markup: string,
  ids: string[],
): { markup: string; groupId: string | null } {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return { markup, groupId: null };
  const root = parseRoot(markup);
  const els = unique.map((id) => findLayer(root, id)).filter((el): el is Element => !!el);
  if (els.length !== unique.length) return { markup, groupId: null };
  const parent = els[0].parentElement;
  if (!parent || !els.every((el) => el.parentElement === parent)) {
    return { markup, groupId: null };
  }
  const byId = new Set(unique);
  const ordered = graphicChildren(parent).filter((el) => byId.has(el.getAttribute(LAYER_ATTR) || ""));
  if (!ordered.length) return { markup, groupId: null };
  const g = root.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute(NAME_ATTR, "Group");
  parent.insertBefore(g, ordered[0]);
  for (const el of ordered) g.appendChild(el);
  ensureLayerIds(root);
  return {
    markup: new XMLSerializer().serializeToString(root),
    groupId: g.getAttribute(LAYER_ATTR),
  };
}

export function ungroupSvgLayer(markup: string, id: string): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  const tag = localName(el);
  if (tag !== "g" && tag !== "a") return markup;
  const parent = el.parentElement;
  if (!parent) return markup;
  for (const kid of graphicChildren(el)) parent.insertBefore(kid, el);
  el.remove();
  return new XMLSerializer().serializeToString(root);
}

export function reparentSvgLayer(
  markup: string,
  id: string,
  newParentId: string | null,
  beforeId: string | null,
): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  const newParent = newParentId ? findLayer(root, newParentId) : root;
  if (!newParent || el === newParent) return markup;
  if (el.contains(newParent)) return markup;
  const before = beforeId ? findLayer(root, beforeId) : null;
  if (before && before.parentNode === newParent && before !== el) {
    newParent.insertBefore(el, before);
  } else {
    newParent.appendChild(el);
  }
  return new XMLSerializer().serializeToString(root);
}

export function setSvgLayerFontSize(markup: string, id: string, fontSize: number): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el || localName(el) !== "text") return markup;
  el.setAttribute("font-size", String(Math.max(1, fontSize)));
  syncTextLineHeight(el);
  return new XMLSerializer().serializeToString(root);
}

export function setSvgLayerFontWeight(markup: string, id: string, weight: SvgTextWeight): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el || localName(el) !== "text") return markup;
  el.setAttribute("font-weight", weightAttr(weight));
  syncTextLineHeight(el);
  return new XMLSerializer().serializeToString(root);
}

export function setSvgLayerTextAlign(markup: string, id: string, align: SvgTextAlign): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el || localName(el) !== "text") return markup;
  el.setAttribute("text-anchor", anchorFromAlign(align));
  syncTextLineHeight(el);
  return new XMLSerializer().serializeToString(root);
}

export function setSvgLayerText(markup: string, id: string, text: string): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el || localName(el) !== "text") return markup;
  writeTextLines(el, text);
  return new XMLSerializer().serializeToString(root);
}

export function translateSvgElement(markup: string, id: string, dx: number, dy: number): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  ensureOrigTransform(el);
  const x = Number(el.getAttribute(TX_ATTR) || 0) + dx;
  const y = Number(el.getAttribute(TY_ATTR) || 0) + dy;
  el.setAttribute(TX_ATTR, String(x));
  el.setAttribute(TY_ATTR, String(y));
  writeExtraTransform(el);
  return new XMLSerializer().serializeToString(root);
}

export function svgElementRotation(markup: string, id: string): number {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return 0;
  const n = Number(el.getAttribute(ROT_ATTR) || 0);
  return Number.isFinite(n) ? n : 0;
}

export function setSvgElementRotation(markup: string, id: string, deg: number): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  ensureOrigTransform(el);
  if (!el.hasAttribute(RCX_ATTR) || !el.hasAttribute(RCY_ATTR)) {
    const pivot = layerPivot(el);
    el.setAttribute(RCX_ATTR, String(pivot.x));
    el.setAttribute(RCY_ATTR, String(pivot.y));
  }
  const rot = Number.isFinite(deg) ? deg : 0;
  el.setAttribute(ROT_ATTR, String(rot));
  writeExtraTransform(el);
  return new XMLSerializer().serializeToString(root);
}

function ensureOrigTransform(el: Element) {
  if (!el.hasAttribute(TF_ATTR)) el.setAttribute(TF_ATTR, el.getAttribute("transform") || "");
}

function writeExtraTransform(el: Element) {
  const x = Number(el.getAttribute(TX_ATTR) || 0);
  const y = Number(el.getAttribute(TY_ATTR) || 0);
  const rot = Number(el.getAttribute(ROT_ATTR) || 0);
  const cx = Number(el.getAttribute(RCX_ATTR) || 0);
  const cy = Number(el.getAttribute(RCY_ATTR) || 0);
  const orig = el.getAttribute(TF_ATTR) || "";
  const parts: string[] = [];
  if (x || y) parts.push(`translate(${x} ${y})`);
  if (rot) parts.push(`rotate(${rot} ${cx} ${cy})`);
  if (orig) parts.push(orig);
  if (parts.length) el.setAttribute("transform", parts.join(" "));
  else el.removeAttribute("transform");
}

function layerPivot(el: Element): { x: number; y: number } {
  const box = elementBox(el);
  if (box) {
    return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  }
  const kind = localName(el);
  if (kind === "rect" || kind === "image") {
    const b = rectBox(el);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }
  if (kind === "circle" || kind === "ellipse") {
    return { x: Number(el.getAttribute("cx") || 0), y: Number(el.getAttribute("cy") || 0) };
  }
  if (kind === "line") {
    return {
      x: (Number(el.getAttribute("x1") || 0) + Number(el.getAttribute("x2") || 0)) / 2,
      y: (Number(el.getAttribute("y1") || 0) + Number(el.getAttribute("y2") || 0)) / 2,
    };
  }
  const bezier = svgElementBezierFromEl(el);
  if (bezier?.nodes.length) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of bezier.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }
  return { x: 0, y: 0 };
}

function svgElementBezierFromEl(el: Element): { nodes: BezierNode[]; closed: boolean } | null {
  const kind = localName(el);
  if (kind === "polygon" || kind === "polyline") {
    const pts = parsePoints(el.getAttribute("points") || "");
    if (pts.length < 2) return null;
    return { nodes: fromRing(pts.map((p): [number, number] => [p.x, p.y])), closed: kind === "polygon" };
  }
  if (kind === "path") return parseSvgPath(el.getAttribute("d") || "");
  return null;
}

export type SvgPoint = { x: number; y: number };

function parsePoints(raw: string): SvgPoint[] {
  const nums = raw.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  const pts: SvgPoint[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}

function formatPoints(pts: SvgPoint[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

function rectBox(el: Element): { x: number; y: number; w: number; h: number } {
  return {
    x: Number(el.getAttribute("x") || 0),
    y: Number(el.getAttribute("y") || 0),
    w: Number(el.getAttribute("width") || 0),
    h: Number(el.getAttribute("height") || 0),
  };
}

function textFontSize(el: Element): number {
  const n = Number(el.getAttribute("font-size") || "");
  return Number.isFinite(n) && n > 0 ? n : 24;
}

function textTspans(el: Element): Element[] {
  return [...el.children].filter((child) => localName(child) === "tspan");
}

function readTextLines(el: Element): string {
  const tspans = textTspans(el);
  if (tspans.length) return tspans.map((t) => t.textContent ?? "").join("\n");
  return el.textContent ?? "";
}

function writeTextLines(el: Element, text: string): void {
  const lines = text.split(/\r?\n/);
  const x = el.getAttribute("x") || "0";
  const n = Math.max(1, lines.length);
  const startDy = -((n - 1) / 2) * TEXT_LINE_EM;
  while (el.firstChild) el.removeChild(el.firstChild);
  for (let i = 0; i < lines.length; i++) {
    const tspan = el.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "tspan");
    tspan.setAttribute("x", x);
    tspan.setAttribute("dy", `${i === 0 ? startDy : TEXT_LINE_EM}em`);
    tspan.textContent = lines[i];
    el.appendChild(tspan);
  }
}

function syncTextLineHeight(el: Element): void {
  const tspans = textTspans(el);
  if (!tspans.length) return;
  const startDy = -((tspans.length - 1) / 2) * TEXT_LINE_EM;
  tspans.forEach((tspan, i) => {
    tspan.setAttribute("dy", `${i === 0 ? startDy : TEXT_LINE_EM}em`);
  });
}

function syncTextTspanX(el: Element): void {
  const x = el.getAttribute("x") || "0";
  for (const tspan of textTspans(el)) tspan.setAttribute("x", x);
}

function weightAttr(weight: SvgTextWeight): string {
  if (weight === "black") return "900";
  if (weight === "bold") return "700";
  return "400";
}

function weightFromAttr(raw: string | null): SvgTextWeight {
  const v = (raw || "").trim().toLowerCase();
  if (v === "black" || v === "900" || v === "800") return "black";
  const n = Number(v);
  if (v === "bold" || v === "bolder" || (Number.isFinite(n) && n >= 600)) return "bold";
  return "regular";
}

function anchorFromAlign(align: SvgTextAlign): "start" | "middle" | "end" {
  if (align === "center") return "middle";
  if (align === "right") return "end";
  return "start";
}

function alignFromAnchor(raw: string | null): SvgTextAlign {
  const v = (raw || "").trim().toLowerCase();
  if (v === "middle") return "center";
  if (v === "end") return "right";
  return "left";
}

function placeTextInBox(el: Element, box: { x: number; y: number; w: number; h: number }): void {
  const lines = Math.max(1, readTextLines(el).split(/\r?\n/).length);
  const fs = Math.max(1, box.h / (TEXT_LINE_EM * lines));
  const align = alignFromAnchor(el.getAttribute("text-anchor") || "middle");
  let x = box.x;
  if (align === "center") x = box.x + box.w / 2;
  else if (align === "right") x = box.x + box.w;
  el.setAttribute("font-size", String(fs));
  el.setAttribute("x", String(x));
  el.setAttribute("y", String(box.y + box.h / 2));
  el.setAttribute("dominant-baseline", "middle");
  syncTextTspanX(el);
  syncTextLineHeight(el);
}

function textBox(el: Element): { minX: number; minY: number; maxX: number; maxY: number; area: number } {
  const fs = textFontSize(el);
  const lines = readTextLines(el).split(/\r?\n/);
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const w = fs * longest * TEXT_CHAR_W;
  const h = fs * TEXT_LINE_EM * Math.max(1, lines.length);
  const cx = Number(el.getAttribute("x") || 0);
  const cy = Number(el.getAttribute("y") || 0);
  const align = alignFromAnchor(el.getAttribute("text-anchor") || "start");
  let minX = cx;
  if (align === "center") minX = cx - w / 2;
  else if (align === "right") minX = cx - w;
  const minY = cy - h / 2;
  return { minX, minY, maxX: minX + w, maxY: minY + h, area: w * h };
}

function rectHandlePoints(b: { x: number; y: number; w: number; h: number }): SvgPoint[] {
  const { x, y, w, h } = b;
  return [
    { x, y },
    { x: x + w / 2, y },
    { x: x + w, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w, y: y + h },
    { x: x + w / 2, y: y + h },
    { x, y: y + h },
    { x, y: y + h / 2 },
  ];
}

function applyRectHandle(
  b: { x: number; y: number; w: number; h: number },
  index: number,
  p: SvgPoint,
): { x: number; y: number; w: number; h: number } {
  let x1 = b.x;
  let y1 = b.y;
  let x2 = b.x + b.w;
  let y2 = b.y + b.h;
  switch (index) {
    case 0:
      x1 = p.x;
      y1 = p.y;
      break;
    case 1:
      y1 = p.y;
      break;
    case 2:
      x2 = p.x;
      y1 = p.y;
      break;
    case 3:
      x2 = p.x;
      break;
    case 4:
      x2 = p.x;
      y2 = p.y;
      break;
    case 5:
      y2 = p.y;
      break;
    case 6:
      x1 = p.x;
      y2 = p.y;
      break;
    case 7:
      x1 = p.x;
      break;
    default:
      break;
  }
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return { x, y, w: Math.max(1, Math.abs(x2 - x1)), h: Math.max(1, Math.abs(y2 - y1)) };
}

function polylineFromPath(d: string): { pts: SvgPoint[]; closed: boolean } | null {
  if (/[CcQqAaSsTt]/.test(d)) return null;
  const pts: SvgPoint[] = [];
  let closed = false;
  let cx = 0;
  let cy = 0;
  let start: SvgPoint | null = null;
  const re = /([MmLlHhVvZz])([^MmLlHhVvZz]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const cmd = m[1];
    const nums = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n));
    if (cmd === "Z" || cmd === "z") {
      closed = true;
      continue;
    }
    if (cmd === "M" || cmd === "L") {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        cx = nums[i];
        cy = nums[i + 1];
        const p = { x: cx, y: cy };
        if (!start) start = p;
        pts.push(p);
      }
    } else if (cmd === "m" || cmd === "l") {
      for (let i = 0; i + 1 < nums.length; i += 2) {
        cx += nums[i];
        cy += nums[i + 1];
        const p = { x: cx, y: cy };
        if (!start) start = p;
        pts.push(p);
      }
    } else if (cmd === "H") {
      for (const n of nums) {
        cx = n;
        pts.push({ x: cx, y: cy });
      }
    } else if (cmd === "h") {
      for (const n of nums) {
        cx += n;
        pts.push({ x: cx, y: cy });
      }
    } else if (cmd === "V") {
      for (const n of nums) {
        cy = n;
        pts.push({ x: cx, y: cy });
      }
    } else if (cmd === "v") {
      for (const n of nums) {
        cy += n;
        pts.push({ x: cx, y: cy });
      }
    }
  }
  if (pts.length < 2) return null;
  return { pts, closed };
}

function pathFromPolyline(pts: SvgPoint[], closed: boolean): string {
  if (!pts.length) return "";
  const body = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  return closed ? `${body} Z` : body;
}

export function svgElementBezier(markup: string, id: string): { nodes: BezierNode[]; closed: boolean } | null {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return null;
  const kind = localName(el);
  if (kind === "polygon" || kind === "polyline") {
    const pts = parsePoints(el.getAttribute("points") || "");
    if (pts.length < 2) return null;
    return { nodes: fromRing(pts.map((p): [number, number] => [p.x, p.y])), closed: kind === "polygon" };
  }
  if (kind === "path") {
    return parseSvgPath(el.getAttribute("d") || "");
  }
  if (kind === "line") {
    return {
      nodes: [
        corner(Number(el.getAttribute("x1") || 0), Number(el.getAttribute("y1") || 0)),
        corner(Number(el.getAttribute("x2") || 0), Number(el.getAttribute("y2") || 0)),
      ],
      closed: false,
    };
  }
  return null;
}

function writePathEl(el: Element, nodes: BezierNode[], closed: boolean): Element {
  const d = svgPathD(nodes, closed);
  if (localName(el) === "path") {
    el.setAttribute("d", d);
    el.removeAttribute("points");
    return el;
  }
  const path = el.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === "points" || attr.name === "d") continue;
    path.setAttribute(attr.name, attr.value);
  }
  path.setAttribute("d", d);
  el.parentNode?.replaceChild(path, el);
  return path;
}

export function setSvgElementBezier(markup: string, id: string, nodes: BezierNode[], closed: boolean): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  const kind = localName(el);
  if (kind === "rect") return markup;
  writePathEl(el, nodes, closed);
  return new XMLSerializer().serializeToString(root);
}

export function setSvgElementBox(
  markup: string,
  id: string,
  box: { x: number; y: number; w: number; h: number },
): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  const kind = localName(el);
  const w = Math.max(1, box.w);
  const h = Math.max(1, box.h);
  if (kind === "rect" || kind === "image") {
    el.setAttribute("x", String(box.x));
    el.setAttribute("y", String(box.y));
    el.setAttribute("width", String(w));
    el.setAttribute("height", String(h));
  } else if (kind === "circle") {
    el.setAttribute("cx", String(box.x + w / 2));
    el.setAttribute("cy", String(box.y + h / 2));
    el.setAttribute("r", String(Math.max(1, Math.min(w, h) / 2)));
  } else if (kind === "ellipse") {
    el.setAttribute("cx", String(box.x + w / 2));
    el.setAttribute("cy", String(box.y + h / 2));
    el.setAttribute("rx", String(Math.max(1, w / 2)));
    el.setAttribute("ry", String(Math.max(1, h / 2)));
  } else if (kind === "text") {
    placeTextInBox(el, { x: box.x, y: box.y, w, h });
  } else {
    return markup;
  }
  return new XMLSerializer().serializeToString(root);
}

export function svgElementPoints(markup: string, id: string): SvgPoint[] | null {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return null;
  const kind = localName(el);
  if (kind === "polygon" || kind === "polyline") {
    const pts = parsePoints(el.getAttribute("points") || "");
    return pts.length ? pts : null;
  }
  if (kind === "rect" || kind === "image") return rectHandlePoints(rectBox(el));
  if (kind === "circle") {
    const cx = Number(el.getAttribute("cx") || 0);
    const cy = Number(el.getAttribute("cy") || 0);
    const r = Number(el.getAttribute("r") || 0);
    return rectHandlePoints({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 });
  }
  if (kind === "ellipse") {
    const cx = Number(el.getAttribute("cx") || 0);
    const cy = Number(el.getAttribute("cy") || 0);
    const rx = Number(el.getAttribute("rx") || 0);
    const ry = Number(el.getAttribute("ry") || 0);
    return rectHandlePoints({ x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 });
  }
  if (kind === "text") {
    const b = textBox(el);
    return rectHandlePoints({ x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY });
  }
  if (kind === "path") {
    const parsed = parseSvgPath(el.getAttribute("d") || "");
    return parsed?.nodes.map((n) => ({ x: n.x, y: n.y })) ?? null;
  }
  if (kind === "line") {
    return [
      { x: Number(el.getAttribute("x1") || 0), y: Number(el.getAttribute("y1") || 0) },
      { x: Number(el.getAttribute("x2") || 0), y: Number(el.getAttribute("y2") || 0) },
    ];
  }
  return null;
}

export type SvgMetrics = { w: number; h: number; area: number };

function shoelaceArea(pts: SvgPoint[]): number {
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function elementBox(el: Element): { minX: number; minY: number; maxX: number; maxY: number; area: number } | null {
  const kind = localName(el);
  if (kind === "rect") {
    const x = Number(el.getAttribute("x") || 0);
    const y = Number(el.getAttribute("y") || 0);
    const w = Number(el.getAttribute("width") || 0);
    const h = Number(el.getAttribute("height") || 0);
    return { minX: x, minY: y, maxX: x + w, maxY: y + h, area: w * h };
  }
  if (kind === "circle") {
    const cx = Number(el.getAttribute("cx") || 0);
    const cy = Number(el.getAttribute("cy") || 0);
    const r = Number(el.getAttribute("r") || 0);
    return { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r, area: Math.PI * r * r };
  }
  if (kind === "ellipse") {
    const cx = Number(el.getAttribute("cx") || 0);
    const cy = Number(el.getAttribute("cy") || 0);
    const rx = Number(el.getAttribute("rx") || 0);
    const ry = Number(el.getAttribute("ry") || 0);
    return { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry, area: Math.PI * rx * ry };
  }
  if (kind === "image") {
    const x = Number(el.getAttribute("x") || 0);
    const y = Number(el.getAttribute("y") || 0);
    const w = Number(el.getAttribute("width") || 0);
    const h = Number(el.getAttribute("height") || 0);
    return { minX: x, minY: y, maxX: x + w, maxY: y + h, area: w * h };
  }
  if (kind === "text") {
    return textBox(el);
  }
  if (kind === "line") {
    const x1 = Number(el.getAttribute("x1") || 0);
    const y1 = Number(el.getAttribute("y1") || 0);
    const x2 = Number(el.getAttribute("x2") || 0);
    const y2 = Number(el.getAttribute("y2") || 0);
    return {
      minX: Math.min(x1, x2),
      minY: Math.min(y1, y2),
      maxX: Math.max(x1, x2),
      maxY: Math.max(y1, y2),
      area: 0,
    };
  }
  if (kind === "polygon" || kind === "polyline") {
    const pts = parsePoints(el.getAttribute("points") || "");
    if (!pts.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY, area: kind === "polygon" ? shoelaceArea(pts) : 0 };
  }
  if (kind === "path") {
    const parsed = parseSvgPath(el.getAttribute("d") || "");
    if (!parsed?.nodes.length) return null;
    const pts = parsed.nodes.map((n) => ({ x: n.x, y: n.y }));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY, area: parsed.closed ? shoelaceArea(pts) : 0 };
  }
  if (kind === "g") {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let area = 0;
    let any = false;
    for (const child of graphicChildren(el)) {
      const box = elementBox(child);
      if (!box) continue;
      any = true;
      minX = Math.min(minX, box.minX);
      minY = Math.min(minY, box.minY);
      maxX = Math.max(maxX, box.maxX);
      maxY = Math.max(maxY, box.maxY);
      area += box.area;
    }
    if (!any) return null;
    return { minX, minY, maxX, maxY, area };
  }
  return null;
}

export function svgElementMetrics(markup: string, id: string): SvgMetrics | null {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return null;
  const box = elementBox(el);
  if (!box) return null;
  return {
    w: Math.max(0, box.maxX - box.minX),
    h: Math.max(0, box.maxY - box.minY),
    area: box.area,
  };
}

export function setSvgElementPoint(
  markup: string,
  id: string,
  index: number,
  point: SvgPoint,
  opts?: { constrain?: boolean; keepRectangle?: boolean },
): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  const keepRect = opts?.keepRectangle !== false;
  const kind = localName(el);
  if (kind === "polygon" || kind === "polyline") {
    const pts = parsePoints(el.getAttribute("points") || "");
    if (!pts[index]) return markup;
    const nodes = fromRing(pts.map((p): [number, number] => [p.x, p.y]));
    const next =
      keepRect && isRectangleShape(nodes)
        ? resizeRectangleCorner(nodes, index, point.x, point.y, opts?.constrain)
        : moveNode(nodes, index, point.x, point.y);
    el.setAttribute("points", formatPoints(next.map((n) => ({ x: n.x, y: n.y }))));
  } else if (kind === "rect" || kind === "image") {
    const next = applyRectHandle(rectBox(el), index, point);
    el.setAttribute("x", String(next.x));
    el.setAttribute("y", String(next.y));
    el.setAttribute("width", String(next.w));
    el.setAttribute("height", String(next.h));
  } else if (kind === "circle" || kind === "ellipse") {
    const cx = Number(el.getAttribute("cx") || 0);
    const cy = Number(el.getAttribute("cy") || 0);
    const rx = kind === "circle" ? Number(el.getAttribute("r") || 0) : Number(el.getAttribute("rx") || 0);
    const ry = kind === "circle" ? rx : Number(el.getAttribute("ry") || 0);
    const next = applyRectHandle({ x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 }, index, point);
    const ncx = next.x + next.w / 2;
    const ncy = next.y + next.h / 2;
    if (kind === "circle") {
      const r = Math.max(1, Math.min(next.w, next.h) / 2);
      el.setAttribute("cx", String(ncx));
      el.setAttribute("cy", String(ncy));
      el.setAttribute("r", String(r));
    } else {
      el.setAttribute("cx", String(ncx));
      el.setAttribute("cy", String(ncy));
      el.setAttribute("rx", String(Math.max(1, next.w / 2)));
      el.setAttribute("ry", String(Math.max(1, next.h / 2)));
    }
  } else if (kind === "text") {
    const b = textBox(el);
    const next = applyRectHandle(
      { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY },
      index,
      point,
    );
    placeTextInBox(el, next);
  } else if (kind === "path") {
    const parsed = parseSvgPath(el.getAttribute("d") || "") ?? polylineFromPath(el.getAttribute("d") || "");
    if (!parsed) return markup;
    if ("nodes" in parsed) {
      const next =
        keepRect && isRectangleShape(parsed.nodes)
          ? resizeRectangleCorner(parsed.nodes, index, point.x, point.y, opts?.constrain)
          : moveNode(parsed.nodes, index, point.x, point.y);
      el.setAttribute("d", svgPathD(next, parsed.closed));
    } else if (parsed.pts[index]) {
      parsed.pts[index] = point;
      el.setAttribute("d", pathFromPolyline(parsed.pts, parsed.closed));
    }
  } else if (kind === "line") {
    if (index === 0) {
      el.setAttribute("x1", String(point.x));
      el.setAttribute("y1", String(point.y));
    } else if (index === 1) {
      el.setAttribute("x2", String(point.x));
      el.setAttribute("y2", String(point.y));
    }
  }
  return new XMLSerializer().serializeToString(root);
}

function svgOpacityFromEl(el: Element): number {
  const raw = el.getAttribute("opacity");
  if (raw == null || raw === "") return 1;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

export function svgElementOpacity(markup: string, id: string): number {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return 1;
  return svgOpacityFromEl(el);
}

export function setSvgElementOpacity(markup: string, id: string, opacity: number): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  const n = Math.min(1, Math.max(0, Number.isFinite(opacity) ? opacity : 1));
  if (n >= 1) el.removeAttribute("opacity");
  else el.setAttribute("opacity", String(n));
  return new XMLSerializer().serializeToString(root);
}

function parseStrokeWidth(raw: string | null): number {
  if (!raw) return 2;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 2;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function opacityFromAttr(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return clamp01(n);
}

function opacityFromColor(value: string): number | null {
  const v = value.trim();
  const rgba = v.match(/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+)\s*)?\)/i);
  if (rgba) {
    if (rgba[1] == null) return 1;
    const n = Number(rgba[1]);
    return Number.isFinite(n) ? clamp01(n) : 1;
  }
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return clamp01(Number.parseInt(v.slice(7, 9), 16) / 255);
  return null;
}

function channelOpacity(color: string, attr: string | null): number {
  return opacityFromAttr(attr) ?? opacityFromColor(color) ?? 1;
}

function parseStyle(el: Element): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of (el.getAttribute("style") || "").split(";")) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim();
    if (k && v) map.set(k, v);
  }
  return map;
}

function writeStyle(el: Element, map: Map<string, string>) {
  const s = [...map.entries()].map(([k, v]) => `${k}:${v}`).join(";");
  if (s) el.setAttribute("style", s);
  else el.removeAttribute("style");
}

function paintFromEl(el: Element, name: "fill" | "stroke"): string {
  const attr = el.getAttribute(name);
  if (attr) return attr;
  return parseStyle(el).get(name) || "";
}

function opacityAttr(el: Element, name: "fill-opacity" | "stroke-opacity"): string | null {
  return el.getAttribute(name) || parseStyle(el).get(name) || null;
}

function setPaintProp(
  el: Element,
  name: "fill" | "stroke" | "stroke-width" | "fill-opacity" | "stroke-opacity",
  value: string | null,
) {
  const styles = parseStyle(el);
  if (value == null || value === "") {
    el.removeAttribute(name);
    styles.delete(name);
  } else {
    el.setAttribute(name, value);
    if (styles.has(name)) styles.set(name, value);
  }
  writeStyle(el, styles);
}

function writeOpacityAttr(el: Element, name: "fill-opacity" | "stroke-opacity", value: number) {
  const n = clamp01(Number.isFinite(value) ? value : 1);
  setPaintProp(el, name, n >= 1 ? null : String(n));
}

function opaqueColor(value: string): string | null {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(0, 7);
  const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return null;
  const hex = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
}

export type SvgElementPaint = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  fillOpacity: number;
  strokeOpacity: number;
};

export function svgElementPaint(markup: string, id: string): SvgElementPaint | null {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return null;
  const fill = paintFromEl(el, "fill");
  const stroke = paintFromEl(el, "stroke");
  return {
    fill,
    stroke,
    strokeWidth: parseStrokeWidth(el.getAttribute("stroke-width") || parseStyle(el).get("stroke-width") || null),
    fillOpacity: channelOpacity(fill, opacityAttr(el, "fill-opacity")),
    strokeOpacity: channelOpacity(stroke, opacityAttr(el, "stroke-opacity")),
  };
}

export function setSvgElementPaint(
  markup: string,
  id: string,
  paint: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    fillOpacity?: number;
    strokeOpacity?: number;
  },
): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  if (paint.fill !== undefined) {
    setPaintProp(el, "fill", paint.fill === "" ? "none" : paint.fill);
  }
  if (paint.stroke !== undefined) {
    setPaintProp(el, "stroke", paint.stroke === "" ? "none" : paint.stroke);
  }
  if (paint.strokeWidth !== undefined) {
    const n = Number.isFinite(paint.strokeWidth) ? Math.max(0, paint.strokeWidth) : 2;
    setPaintProp(el, "stroke-width", String(n));
  }
  if (paint.fillOpacity !== undefined) {
    writeOpacityAttr(el, "fill-opacity", paint.fillOpacity);
    const next = opaqueColor(paintFromEl(el, "fill"));
    if (next) setPaintProp(el, "fill", next);
  }
  if (paint.strokeOpacity !== undefined) {
    writeOpacityAttr(el, "stroke-opacity", paint.strokeOpacity);
    const next = opaqueColor(paintFromEl(el, "stroke"));
    if (next) setPaintProp(el, "stroke", next);
  }
  return new XMLSerializer().serializeToString(root);
}

export function layerAttrSelector(id: string): string {
  return `[${LAYER_ATTR}="${CSS.escape(id)}"]`;
}

export { LAYER_ATTR, LOCK_ATTR, PRIVATE_ATTR };
