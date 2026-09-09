const LAYER_ATTR = "data-cm-layer";
const TX_ATTR = "data-cm-tx";
const TY_ATTR = "data-cm-ty";
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

export type SvgLayer = {
  id: string;
  name: string;
  kind: string;
  hidden: boolean;
  text: string | null;
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
const SHAPE_FILL = "rgba(0,0,0,0.06)";

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

export function lastSvgLayerId(markup: string): string | null {
  const layers = listSvgLayers(markup);
  return layers[0]?.id ?? null;
}

export function appendSvgPolygon(markup: string, points: SvgPoint[]): string {
  if (points.length < 3) return markup;
  const root = parseRoot(markup);
  const el = root.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "polygon");
  el.setAttribute("points", formatPoints(points));
  el.setAttribute("fill", SHAPE_FILL);
  el.setAttribute("stroke", SHAPE_STROKE);
  el.setAttribute("stroke-width", "2");
  root.appendChild(el);
  ensureLayerIds(root);
  return new XMLSerializer().serializeToString(root);
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

function isHidden(el: Element): boolean {
  const display = (el.getAttribute("display") || "").toLowerCase();
  if (display === "none") return true;
  const vis = (el.getAttribute("visibility") || "").toLowerCase();
  if (vis === "hidden" || vis === "collapse") return true;
  const style = el.getAttribute("style") || "";
  return /display\s*:\s*none/i.test(style);
}

function layerName(el: Element, index: number): string {
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
    text: kind === "text" ? (el.textContent || "").replace(/\s+/g, " ").trim() : null,
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

export function svgViewBox(markup: string): { x: number; y: number; w: number; h: number } | null {
  const root = parseRoot(markup);
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

export function svgInnerMarkup(markup: string, opts?: { hoverId?: string | null; selectedId?: string | null }): string {
  const root = parseRoot(markup);
  const hoverId = opts?.hoverId ?? null;
  const selectedId = opts?.selectedId ?? null;
  for (const el of collectNodes(root)) {
    const id = el.getAttribute(LAYER_ATTR);
    if (id && id === selectedId) el.setAttribute("data-cm-selected", "1");
    else el.removeAttribute("data-cm-selected");
    if (id && id === hoverId) el.setAttribute("data-cm-hover", "1");
    else el.removeAttribute("data-cm-hover");
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

export function setSvgLayerText(markup: string, id: string, text: string): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el || localName(el) !== "text") return markup;
  const tspans = [...el.querySelectorAll("tspan")];
  if (tspans.length) {
    tspans[0].textContent = text;
    for (const extra of tspans.slice(1)) extra.remove();
  } else {
    el.textContent = text;
  }
  return new XMLSerializer().serializeToString(root);
}

export function translateSvgElement(markup: string, id: string, dx: number, dy: number): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  const x = Number(el.getAttribute(TX_ATTR) || 0) + dx;
  const y = Number(el.getAttribute(TY_ATTR) || 0) + dy;
  if (!el.hasAttribute(TF_ATTR)) el.setAttribute(TF_ATTR, el.getAttribute("transform") || "");
  el.setAttribute(TX_ATTR, String(x));
  el.setAttribute(TY_ATTR, String(y));
  const orig = el.getAttribute(TF_ATTR) || "";
  el.setAttribute("transform", `translate(${x} ${y})${orig ? ` ${orig}` : ""}`);
  return new XMLSerializer().serializeToString(root);
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

export function svgElementPoints(markup: string, id: string): SvgPoint[] | null {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return null;
  const kind = localName(el);
  if (kind === "polygon" || kind === "polyline") {
    const pts = parsePoints(el.getAttribute("points") || "");
    return pts.length ? pts : null;
  }
  if (kind === "rect") return rectHandlePoints(rectBox(el));
  if (kind === "path") {
    const parsed = polylineFromPath(el.getAttribute("d") || "");
    return parsed?.pts.length ? parsed.pts : null;
  }
  if (kind === "line") {
    return [
      { x: Number(el.getAttribute("x1") || 0), y: Number(el.getAttribute("y1") || 0) },
      { x: Number(el.getAttribute("x2") || 0), y: Number(el.getAttribute("y2") || 0) },
    ];
  }
  return null;
}

export function setSvgElementPoint(markup: string, id: string, index: number, point: SvgPoint): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  const kind = localName(el);
  if (kind === "polygon" || kind === "polyline") {
    const pts = parsePoints(el.getAttribute("points") || "");
    if (!pts[index]) return markup;
    pts[index] = point;
    el.setAttribute("points", formatPoints(pts));
  } else if (kind === "rect") {
    const next = applyRectHandle(rectBox(el), index, point);
    el.setAttribute("x", String(next.x));
    el.setAttribute("y", String(next.y));
    el.setAttribute("width", String(next.w));
    el.setAttribute("height", String(next.h));
  } else if (kind === "path") {
    const parsed = polylineFromPath(el.getAttribute("d") || "");
    if (!parsed?.pts[index]) return markup;
    parsed.pts[index] = point;
    el.setAttribute("d", pathFromPolyline(parsed.pts, parsed.closed));
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

export function svgElementPaint(markup: string, id: string): { fill: string; stroke: string } | null {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return null;
  return {
    fill: el.getAttribute("fill") || "",
    stroke: el.getAttribute("stroke") || "",
  };
}

export function setSvgElementPaint(
  markup: string,
  id: string,
  paint: { fill?: string; stroke?: string },
): string {
  const root = parseRoot(markup);
  const el = findLayer(root, id);
  if (!el) return markup;
  if (paint.fill !== undefined) {
    if (paint.fill === "") el.removeAttribute("fill");
    else el.setAttribute("fill", paint.fill);
  }
  if (paint.stroke !== undefined) {
    if (paint.stroke === "") el.removeAttribute("stroke");
    else el.setAttribute("stroke", paint.stroke);
  }
  return new XMLSerializer().serializeToString(root);
}

export function layerAttrSelector(id: string): string {
  return `[${LAYER_ATTR}="${CSS.escape(id)}"]`;
}

export { LAYER_ATTR };
