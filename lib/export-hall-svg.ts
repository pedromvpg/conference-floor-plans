import { amenityLabel } from "./amenities";
import { tessellate } from "./bezier";
import { boothFillHex, darkenHex } from "./colors";
import { closeRing, ringBounds, ringCentroid, venueWorldRect } from "./geometry";
import { facingObb, isometricPose, sunPosition, yawRad } from "./hall";
import type { HallView } from "./hall-view";
import { resolvedIconPaint } from "./paint";
import { pinIconSvgMarkup } from "./pin-icons";
import { svgVenueWorldPolylines } from "./svg-layers";
import type { Floor, MapObject, Ring, Sponsor } from "./types";
import { isMapPinObject, isPinObject, MAP_PIN_META } from "./types";
import { resolveAppearance } from "./appearance";

const NS = "http://www.w3.org/2000/svg";
const INK = "http://www.inkscape.org/namespaces/inkscape";
const HALL_FOV = 42;
const FIGMA_MAX = 2500;

type V3 = { x: number; y: number; z: number };
type V2 = { x: number; y: number };

type Face = {
  pts: V3[];
  fill: string;
  stroke?: string;
  depth: number;
  label?: string;
  kind: "poly" | "path";
  closed?: boolean;
};

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");
}

function sub(a: V3, b: V3): V3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: V3, b: V3): V3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(a: V3, s: number): V3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function dot(a: V3, b: V3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: V3, b: V3): V3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function len(a: V3): number {
  return Math.hypot(a.x, a.y, a.z);
}

function norm(a: V3): V3 {
  const l = len(a) || 1;
  return scale(a, 1 / l);
}

function avg(pts: V3[]): V3 {
  const n = pts.length || 1;
  return pts.reduce((s, p) => add(s, p), { x: 0, y: 0, z: 0 });
}

function mixHex(hex: string, toward: string, t: number): string {
  const a = parseInt(hex.slice(1), 16);
  const b = parseInt(toward.slice(1), 16);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return hex;
  const ch = (n: number, shift: number) => (n >> shift) & 255;
  const m = (ca: number, cb: number) => Math.round(ca + (cb - ca) * t);
  const r = m(ch(a, 16), ch(b, 16));
  const g = m(ch(a, 8), ch(b, 8));
  const bl = m(ch(a, 0), ch(b, 0));
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

function plotRing(o: MapObject): Ring | null {
  if (o.path?.length) return tessellate(o.path, true);
  if (o.polygon?.length) return o.polygon;
  return null;
}

function objectTitle(o: MapObject, sponsor?: Sponsor): string {
  return (
    sponsor?.name ||
    o.name ||
    o.boothNumber ||
    (isMapPinObject(o) ? MAP_PIN_META[o.kind].label : amenityLabel(o.amenityType ?? "info"))
  );
}

function plotHeight(o: MapObject, cuboids: boolean): number {
  const stage = resolveAppearance(o) === "stage";
  if (cuboids) return stage ? 4.6 : 2.5;
  return stage ? 0.4 : 0.05;
}

function wallHeight(o: MapObject): number {
  return resolveAppearance(o) === "stage" ? 4.2 : 2.5;
}

function shadeFace(fill: string, pts: V3[], cam: V3, sun: V3): string {
  if (pts.length < 3) return fill;
  const n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  const c = avg(pts);
  const toCam = sub(cam, c);
  if (dot(n, toCam) < 0) return "";
  const light = norm(sub(sun, c));
  const lambert = Math.max(0, dot(n, light));
  const t = 0.38 + lambert * 0.5;
  return mixHex(darkenHex(fill, 0.55), fill, t);
}

type Cam = {
  pos: V3;
  x: V3;
  y: V3;
  z: V3;
  ortho: boolean;
  tanHalf: number;
};

function makeCam(pos: V3, target: V3, ortho: boolean): Cam {
  const z = norm(sub(pos, target));
  let x = cross({ x: 0, y: 1, z: 0 }, z);
  if (len(x) < 1e-6) x = { x: 1, y: 0, z: 0 };
  x = norm(x);
  const y = cross(z, x);
  return { pos, x, y, z, ortho, tanHalf: Math.tan((HALL_FOV * Math.PI) / 360) };
}

function toCam(cam: Cam, p: V3) {
  const r = sub(p, cam.pos);
  return { x: dot(r, cam.x), y: dot(r, cam.y), z: dot(r, cam.z) };
}

function projectRaw(cam: Cam, p: V3): V2 | null {
  const c = toCam(cam, p);
  if (cam.ortho) return { x: c.x, y: -c.y };
  if (-c.z <= 1e-4) return null;
  const k = 1 / (-c.z * cam.tanHalf);
  return { x: c.x * k, y: -c.y * k };
}

function rotateLocal(cx: number, cz: number, lx: number, ly: number, lz: number, facingDeg: number): V3 {
  const th = yawRad(facingDeg);
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  return {
    x: cx + lx * cos + lz * sin,
    y: ly,
    z: cz + -lx * sin + lz * cos,
  };
}

function boxCorners(cx: number, cz: number, facingDeg: number, ox: number, oy: number, oz: number, w: number, h: number, d: number): V3[] {
  const hx = w / 2;
  const hy = h / 2;
  const hz = d / 2;
  const local: [number, number, number][] = [
    [-hx, -hy, -hz],
    [hx, -hy, -hz],
    [hx, -hy, hz],
    [-hx, -hy, hz],
    [-hx, hy, -hz],
    [hx, hy, -hz],
    [hx, hy, hz],
    [-hx, hy, hz],
  ];
  return local.map(([x, y, z]) => rotateLocal(cx, cz, ox + x, oy + y, oz + z, facingDeg));
}

const BOX_FACES: number[][] = [
  [0, 1, 2, 3],
  [7, 6, 5, 4],
  [4, 5, 1, 0],
  [6, 7, 3, 2],
  [5, 6, 2, 1],
  [7, 4, 0, 3],
];

function pushBox(faces: Face[], corners: V3[], fill: string, cam: V3, sun: V3, label: string) {
  for (const idx of BOX_FACES) {
    const pts = idx.map((i) => corners[i]);
    const shaded = shadeFace(fill, pts, cam, sun);
    if (!shaded) continue;
    faces.push({ pts, fill: shaded, depth: len(sub(avg(pts), cam)), label, kind: "poly" });
  }
}

function pushPrism(faces: Face[], ring: Ring, h: number, fill: string, cam: V3, sun: V3, label: string) {
  const closed = closeRing(ring);
  const pts = closed.length > 1 ? closed.slice(0, -1) : closed;
  if (pts.length < 3) return;
  const top = pts.map(([x, y]) => ({ x, y: h, z: y }));
  const bot = pts.map(([x, y]) => ({ x, y: 0, z: y }));
  const topFill = shadeFace(fill, [...top].reverse(), cam, sun) || shadeFace(fill, top, cam, sun);
  if (topFill) {
    const use = shadeFace(fill, top, cam, sun) ? top : [...top].reverse();
    faces.push({ pts: use, fill: topFill, depth: len(sub(avg(use), cam)), label, kind: "poly" });
  }
  for (let i = 0; i < pts.length; i++) {
    const a = bot[i];
    const b = bot[(i + 1) % pts.length];
    const c = top[(i + 1) % pts.length];
    const d = top[i];
    const quad = [a, d, c, b];
    const shaded = shadeFace(fill, quad, cam, sun);
    if (!shaded) continue;
    faces.push({ pts: quad, fill: shaded, depth: len(sub(avg(quad), cam)), label, kind: "poly" });
  }
}

export type HallExportInput = {
  floor: Floor;
  objects: MapObject[];
  sponsors: Sponsor[];
  venueSvg?: string | null;
  name?: string;
  hallView: HallView;
};

export function buildHallSvg(input: HallExportInput): string {
  const { floor, objects, sponsors, venueSvg, name, hallView } = input;
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
    const ring = plotRing(o);
    if (ring?.length) {
      const b = ringBounds(ring);
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
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, 8);
  const pose = isometricPose(cx, cy, span, hallView);
  const camPos = { x: pose.position[0], y: pose.position[1], z: pose.position[2] };
  const target = { x: pose.target[0], y: pose.target[1], z: pose.target[2] };
  const cam = makeCam(camPos, target, hallView.orthographic);
  const sunP = sunPosition(cx, cy, span, {
    azimuth: hallView.lightAzimuth,
    elevation: hallView.lightElevation,
    distance: hallView.lightDistance,
  });
  const sun = { x: sunP[0], y: sunP[1], z: sunP[2] };

  const faces: Face[] = [];
  if (venue) {
    const ground: Ring = [
      [venue.minX, venue.minY],
      [venue.maxX, venue.minY],
      [venue.maxX, venue.maxY],
      [venue.minX, venue.maxY],
    ];
    pushPrism(faces, ground, 0.02, "#e8e8e2", camPos, sun, "Floor");
  }
  if (venueSvg && cal) {
    for (const line of svgVenueWorldPolylines(venueSvg, cal)) {
      if (line.points.length < 2) continue;
      const pts = line.points.map(([x, y]) => ({ x, y: 0.03, z: y }));
      faces.push({
        pts,
        fill: "none",
        stroke: "#9a9a92",
        depth: len(sub(avg(pts), camPos)),
        label: "Venue",
        kind: "path",
        closed: line.closed,
      });
    }
  }

  const plots = objects.filter((o) => !isPinObject(o) && plotRing(o));
  for (const o of plots) {
    const ring = plotRing(o)!;
    const sponsor = o.sponsorId ? bySponsor.get(o.sponsorId) : undefined;
    const fill = boothFillHex(
      o.color,
      sponsor?.tier ?? "",
      "light",
      resolveAppearance(o) === "stage" ? "stage" : "booth",
    );
    const title = objectTitle(o, sponsor);
    const h = plotHeight(o, hallView.cuboids);
    pushPrism(faces, ring, Math.max(h, 0.04), fill, camPos, sun, title);
    if (!hallView.cuboids) {
      const obb = facingObb(ring, o.facingDeg ?? 0);
      const wh = wallHeight(o);
      const ww = Math.max(0.4, obb.w - 0.08);
      const corners = boxCorners(obb.cx, obb.cy, o.facingDeg ?? 0, obb.backX, wh / 2, obb.backZ + 0.06, ww, wh, 0.12);
      pushBox(faces, corners, darkenHex(fill, 0.32), camPos, sun, `${title} wall`);
    }
  }

  faces.sort((a, b) => b.depth - a.depth);

  const projected: { face: Face; pts: V2[] }[] = [];
  for (const face of faces) {
    const pts: V2[] = [];
    let ok = true;
    for (const p of face.pts) {
      const q = projectRaw(cam, p);
      if (!q) {
        ok = false;
        break;
      }
      pts.push(q);
    }
    if (ok && pts.length >= 2) projected.push({ face, pts });
  }

  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const { pts } of projected) {
    for (const p of pts) {
      bx0 = Math.min(bx0, p.x);
      by0 = Math.min(by0, p.y);
      bx1 = Math.max(bx1, p.x);
      by1 = Math.max(by1, p.y);
    }
  }
  if (!Number.isFinite(bx0)) {
    bx0 = 0;
    by0 = 0;
    bx1 = 1;
    by1 = 1;
  }
  const pad = Math.max(bx1 - bx0, by1 - by0) * 0.06 || 1;
  bx0 -= pad;
  by0 -= pad;
  bx1 += pad;
  by1 += pad;
  const scale2 = Math.min(FIGMA_MAX / Math.max(bx1 - bx0, 1e-6), FIGMA_MAX / Math.max(by1 - by0, 1e-6), 80);
  const W = (bx1 - bx0) * scale2;
  const H = (by1 - by0) * scale2;
  const map = (p: V2) => ({ x: (p.x - bx0) * scale2, y: (p.y - by0) * scale2 });
  const poly = (pts: V2[]) => pts.map((p) => `${num(map(p).x)},${num(map(p).y)}`).join(" ");

  const used = new Set<string>();
  const layerId = (name: string, fallback: string) => {
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
  };

  const kids: string[] = [];
  for (const { face, pts } of projected) {
    const id = layerId(face.label || "face", "face");
    if (face.kind === "path") {
      const d = pts
        .map((p, i) => {
          const m = map(p);
          return `${i === 0 ? "M" : "L"}${num(m.x)} ${num(m.y)}`;
        })
        .join(" ");
      const close = face.closed ? " Z" : "";
      kids.push(
        `<path id="${id}" d="${d}${close}" fill="none" stroke="${face.stroke || "#9a9a92"}" stroke-width="${num(Math.max(0.4, scale2 * 0.015))}" stroke-linejoin="round"/>`,
      );
      continue;
    }
    kids.push(
      `<polygon id="${id}" points="${poly(pts)}" fill="${face.fill}" stroke="${darkenHex(face.fill, 0.42)}" stroke-width="${num(Math.max(0.35, scale2 * 0.012))}" stroke-linejoin="round"/>`,
    );
  }

  const labels: string[] = [];
  for (const o of plots) {
    const ring = plotRing(o)!;
    const c = ringCentroid(ring);
    const h = plotHeight(o, hallView.cuboids);
    const q = projectRaw(cam, { x: c.x, y: h + 0.05, z: c.y });
    if (!q) continue;
    const p = map(q);
    const sponsor = o.sponsorId ? bySponsor.get(o.sponsorId) : undefined;
    const text = (sponsor?.name || o.name || o.boothNumber || "").trim();
    if (!text) continue;
    const b = ringBounds(ring);
    const fs = Math.max(8, Math.min(b.w, b.h) * scale2 * 0.08);
    labels.push(
      `<text x="${num(p.x)}" y="${num(p.y)}" text-anchor="middle" dominant-baseline="middle" font-family="Inter, system-ui, sans-serif" font-size="${num(fs)}" font-weight="700" fill="#1a1a1a">${xmlEscape(text)}</text>`,
    );
  }

  const pins = objects.filter((o) => isPinObject(o) && o.x != null && o.y != null);
  const pinKids: string[] = [];
  for (const o of pins) {
    const q = projectRaw(cam, { x: o.x!, y: 1.15, z: o.y! });
    if (!q) continue;
    const p = map(q);
    const look = resolvedIconPaint(o.paint, o.color, "light");
    const r = 0.55 * scale2 * 0.35;
    const title = objectTitle(o);
    const oid = layerId(title, o.id.slice(0, 8));
    const fill = look.fillNone ? "none" : look.fillHex;
    const stroke = look.strokeNone ? "none" : look.strokeHex;
    const glyph = pinIconSvgMarkup(o.kind, o.amenityType, p.x, p.y, r * 1.35, look.glyphHex);
    pinKids.push(
      `<g id="${oid}" inkscape:label="${xmlEscape(title)}" opacity="${num(look.opacity)}"><circle cx="${num(p.x)}" cy="${num(p.y)}" r="${num(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${num(Math.max(0.4, r * 0.08))}"/>${glyph}</g>`,
    );
  }

  const title = xmlEscape(name || floor.name || "Hall");
  const venueLayer = kids.length
    ? `<g id="${layerId("Hall", "hall")}" inkscape:groupmode="layer" inkscape:label="Hall">${kids.join("")}</g>`
    : "";
  const labelLayer = labels.length
    ? `<g id="${layerId("Labels", "labels")}" inkscape:groupmode="layer" inkscape:label="Labels">${labels.join("")}</g>`
    : "";
  const pinLayer = pinKids.length
    ? `<g id="${layerId("Icons", "icons")}" inkscape:groupmode="layer" inkscape:label="Icons">${pinKids.join("")}</g>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="${NS}" xmlns:inkscape="${INK}" viewBox="0 0 ${num(W)} ${num(H)}" width="${num(W)}" height="${num(H)}" fill="none" data-map-view="3d">
  <title>${title} (3D)</title>
  <rect width="${num(W)}" height="${num(H)}" fill="#f4f4f1"/>
  ${venueLayer}
  ${labelLayer}
  ${pinLayer}
</svg>`;
}
