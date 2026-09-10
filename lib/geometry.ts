import type { Calibration, Ring } from "./types";
import { snap } from "./units";

export function hypot(dx: number, dy: number): number {
  return Math.hypot(dx, dy);
}

export function ringCentroid(ring: Ring): { x: number; y: number } {
  if (!ring.length) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const [px, py] of ring) {
    x += px;
    y += py;
  }
  return { x: x / ring.length, y: y / ring.length };
}

export function ringBounds(ring: Ring): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function closeRing(ring: Ring): Ring {
  if (ring.length < 1) return ring;
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx === lx && fy === ly) return ring;
  return [...ring, [fx, fy]];
}

export function rectRing(x0: number, y0: number, x1: number, y1: number, grid = 0): Ring {
  const a = snap(Math.min(x0, x1), grid);
  const b = snap(Math.min(y0, y1), grid);
  const c = snap(Math.max(x0, x1), grid);
  const d = snap(Math.max(y0, y1), grid);
  return [
    [a, b],
    [c, b],
    [c, d],
    [a, d],
  ];
}

export function rectFromCenter(cx: number, cy: number, w: number, d: number, grid = 0): Ring {
  return rectRing(cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2, grid);
}

export function rotateRing(ring: Ring, deg: number): Ring {
  if (!deg) return ring;
  const { x: cx, y: cy } = ringCentroid(ring);
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return ring.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  });
}

export function translateRing(ring: Ring, dx: number, dy: number): Ring {
  return ring.map(([x, y]) => [x + dx, y + dy]);
}

export function scaleRingToSize(ring: Ring, width: number, height: number): Ring {
  const b = ringBounds(ring);
  if (b.w < 1e-9 || b.h < 1e-9) return ring;
  const sx = width / b.w;
  const sy = height / b.h;
  return ring.map(([x, y]) => [b.minX + (x - b.minX) * sx, b.minY + (y - b.minY) * sy]);
}

export type BoundsHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export function handleCursor(handle: BoundsHandle | "rotate"): string {
  if (handle === "rotate") return "grab";
  if (handle === "n" || handle === "s") return "ns-resize";
  if (handle === "e" || handle === "w") return "ew-resize";
  if (handle === "nw" || handle === "se") return "nwse-resize";
  return "nesw-resize";
}

export function angleDeg(cx: number, cy: number, x: number, y: number): number {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

export function snapDeg(deg: number, step: number): number {
  if (step <= 0) return deg;
  return Math.round(deg / step) * step;
}

export function rotateHandlePos(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  offset: number,
): { hx: number; hy: number; cx: number; cy: number } {
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { hx: cx, hy: b.minY - offset, cx, cy };
}

export function resizeBounds(
  start: { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number },
  handle: BoundsHandle,
  x: number,
  y: number,
  grid: number,
  constrain: boolean,
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = start.minX;
  let minY = start.minY;
  let maxX = start.maxX;
  let maxY = start.maxY;
  const sx = snap(x, grid);
  const sy = snap(y, grid);
  if (handle.includes("w")) minX = sx;
  if (handle.includes("e")) maxX = sx;
  if (handle.includes("n")) minY = sy;
  if (handle.includes("s")) maxY = sy;
  if (constrain && start.h > 1e-9 && handle.length === 2) {
    const aspect = start.w / start.h;
    const fromW = Math.abs(maxX - minX);
    const fromH = fromW / aspect;
    if (handle.includes("n")) minY = maxY - fromH;
    else maxY = minY + fromH;
  }
  if (maxX - minX < 0.3) {
    if (handle.includes("w")) minX = maxX - 0.3;
    else maxX = minX + 0.3;
  }
  if (maxY - minY < 0.3) {
    if (handle.includes("n")) minY = maxY - 0.3;
    else maxY = minY + 0.3;
  }
  return { minX, minY, maxX, maxY };
}

export function applyBoundsToRing(
  ring: Ring,
  next: { minX: number; minY: number; maxX: number; maxY: number },
): Ring {
  const o = ringBounds(ring);
  const nw = next.maxX - next.minX;
  const nh = next.maxY - next.minY;
  if (o.w < 1e-9 || o.h < 1e-9) {
    return rectRing(next.minX, next.minY, next.maxX, next.maxY);
  }
  return ring.map(([x, y]) => [
    next.minX + ((x - o.minX) / o.w) * nw,
    next.minY + ((y - o.minY) / o.h) * nh,
  ]);
}

export function squareRectRing(x0: number, y0: number, x1: number, y1: number, grid = 0): Ring {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const s = Math.max(Math.abs(dx), Math.abs(dy));
  const sx = (dx < 0 ? -1 : 1) * s;
  const sy = (dy < 0 ? -1 : 1) * s;
  return rectRing(x0, y0, x0 + sx, y0 + sy, grid);
}

export function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function axisScale(cal: Calibration): { x: number; y: number } {
  return {
    x: cal.metersPerPixel,
    y: cal.metersPerPixelY ?? cal.metersPerPixel,
  };
}

/** Recalibrate: pin image-pixel positions, recompute metres. */
export function reprojectRing(
  ring: Ring,
  oldCal: Calibration,
  nextCal: Calibration,
): Ring {
  return ring.map(([x, y]) => {
    const p = pixelsFromMeters(x, y, oldCal);
    const n = metersFromPixels(p.px, p.py, nextCal);
    return [n.x, n.y];
  });
}

export function venueWorldRect(cal: Calibration): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
} {
  const s = axisScale(cal);
  const w = cal.widthPx * s.x;
  const h = cal.heightPx * s.y;
  const minX = -cal.originX * s.x;
  const minY = -cal.originY * s.y;
  return { minX, minY, maxX: minX + w, maxY: minY + h, w, h };
}

export function calibrationFromWorldRect(
  rect: { minX: number; minY: number; maxX: number; maxY: number },
  widthPx: number,
  heightPx: number,
  rotationDeg = 0,
): Calibration {
  const w = Math.max(0.3, rect.maxX - rect.minX);
  const h = Math.max(0.3, rect.maxY - rect.minY);
  const metersPerPixel = widthPx > 0 ? w / widthPx : 0.1;
  const metersPerPixelY = heightPx > 0 ? h / heightPx : metersPerPixel;
  return {
    originX: metersPerPixel > 0 ? -rect.minX / metersPerPixel : 0,
    originY: metersPerPixelY > 0 ? -rect.minY / metersPerPixelY : 0,
    metersPerPixel,
    metersPerPixelY,
    rotationDeg,
    widthPx,
    heightPx,
  };
}

export function metersFromPixels(px: number, py: number, cal: Calibration): { x: number; y: number } {
  const s = axisScale(cal);
  return {
    x: (px - cal.originX) * s.x,
    y: (py - cal.originY) * s.y,
  };
}

export function pixelsFromMeters(x: number, y: number, cal: Calibration): { px: number; py: number } {
  const s = axisScale(cal);
  return {
    px: x / s.x + cal.originX,
    py: y / s.y + cal.originY,
  };
}

export function calibrationFromTwoClicks(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  knownMeters: number,
  widthPx: number,
  heightPx: number,
): Calibration {
  const distPx = hypot(p2.x - p1.x, p2.y - p1.y);
  const metersPerPixel = distPx > 0 ? knownMeters / distPx : 0.1;
  return {
    originX: 0,
    originY: 0,
    metersPerPixel,
    metersPerPixelY: metersPerPixel,
    rotationDeg: 0,
    widthPx,
    heightPx,
  };
}

export function calibrationFromBounds(
  widthMeters: number,
  heightMeters: number,
  widthPx: number,
  heightPx: number,
  originX = 0,
  originY = 0,
): Calibration {
  const metersPerPixel = widthPx > 0 ? widthMeters / widthPx : 0.1;
  const metersPerPixelY = heightPx > 0 ? heightMeters / heightPx : metersPerPixel;
  return {
    originX,
    originY,
    metersPerPixel,
    metersPerPixelY,
    rotationDeg: 0,
    widthPx,
    heightPx,
  };
}

export function floorSizeMeters(cal: Calibration): { w: number; h: number } {
  const s = axisScale(cal);
  return {
    w: cal.widthPx * s.x,
    h: cal.heightPx * s.y,
  };
}

export function snapToPixel(x: number, y: number, cal: Calibration | null): { x: number; y: number } {
  if (!cal) return { x, y };
  const p = pixelsFromMeters(x, y, cal);
  const n = metersFromPixels(Math.round(p.px), Math.round(p.py), cal);
  return { x: n.x, y: n.y };
}

/** Snap a point to other anchors on the same path (x and y independently). */
export function snapToShapeNodes(
  x: number,
  y: number,
  nodes: { x: number; y: number }[],
  skipIndex: number,
  threshold: number,
): { x: number; y: number; gx: number[]; gy: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (i === skipIndex) continue;
    xs.push(nodes[i].x);
    ys.push(nodes[i].y);
  }
  const sx = xs.length ? snapScalar(x, xs, threshold) : null;
  const sy = ys.length ? snapScalar(y, ys, threshold) : null;
  return {
    x: sx ?? x,
    y: sy ?? y,
    gx: sx != null ? [sx] : [],
    gy: sy != null ? [sy] : [],
  };
}

export function snapScalar(value: number, targets: number[], threshold: number): number | null {
  let best: number | null = null;
  let bestD = threshold;
  for (const t of targets) {
    const d = Math.abs(value - t);
    if (d <= bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

export function alignmentTargets(
  objects: { id: string; polygon: Ring | null; x: number | null; y: number | null }[],
  skipId: string | null,
  underlayW: number,
  underlayH: number,
  originX = 0,
  originY = 0,
  include: { objects?: boolean; underlay?: boolean } = {},
): { xs: number[]; ys: number[] } {
  const includeObjects = include.objects !== false;
  const includeUnderlay = include.underlay !== false;
  const xs: number[] = includeUnderlay ? [originX, originX + underlayW / 2, originX + underlayW] : [];
  const ys: number[] = includeUnderlay ? [originY, originY + underlayH / 2, originY + underlayH] : [];
  if (!includeObjects) return { xs, ys };
  for (const o of objects) {
    if (skipId && o.id === skipId) continue;
    if (o.polygon?.length) {
      const b = ringBounds(o.polygon);
      xs.push(b.minX, (b.minX + b.maxX) / 2, b.maxX);
      ys.push(b.minY, (b.minY + b.maxY) / 2, b.maxY);
    } else if (o.x != null && o.y != null) {
      xs.push(o.x);
      ys.push(o.y);
    }
  }
  return { xs, ys };
}

export function snapTranslation(
  b: { minX: number; maxX: number; minY: number; maxY: number },
  dx: number,
  dy: number,
  xs: number[],
  ys: number[],
  threshold: number,
): { dx: number; dy: number; gx: number[]; gy: number[] } {
  const gx: number[] = [];
  const gy: number[] = [];
  const pick = (
    edges: { pos: number; origin: number }[],
    targets: number[],
    fallback: number,
    out: number[],
  ) => {
    let best = fallback;
    let bestD = threshold;
    let guide: number | null = null;
    for (const e of edges) {
      const t = snapScalar(e.pos, targets, threshold);
      if (t == null) continue;
      const d = Math.abs(e.pos - t);
      if (d <= bestD) {
        bestD = d;
        best = t - e.origin;
        guide = t;
      }
    }
    if (guide != null) out.push(guide);
    return best;
  };
  const ndx = pick(
    [
      { pos: b.minX + dx, origin: b.minX },
      { pos: b.maxX + dx, origin: b.maxX },
      { pos: (b.minX + b.maxX) / 2 + dx, origin: (b.minX + b.maxX) / 2 },
    ],
    xs,
    dx,
    gx,
  );
  const ndy = pick(
    [
      { pos: b.minY + dy, origin: b.minY },
      { pos: b.maxY + dy, origin: b.maxY },
      { pos: (b.minY + b.maxY) / 2 + dy, origin: (b.minY + b.maxY) / 2 },
    ],
    ys,
    dy,
    gy,
  );
  return { dx: ndx, dy: ndy, gx, gy };
}
