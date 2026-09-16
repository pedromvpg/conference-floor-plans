import { ringBounds, ringCentroid } from "./geometry";
import type { BezierMode, BezierNode, Ring } from "./types";

export type { BezierMode, BezierNode };

const EPS = 1e-8;

export function corner(x: number, y: number): BezierNode {
  return { x, y, inDx: 0, inDy: 0, outDx: 0, outDy: 0, mode: "none" };
}

export function fromRing(ring: Ring): BezierNode[] {
  return ring.map(([x, y]) => corner(x, y));
}

export function anchors(nodes: BezierNode[]): Ring {
  return nodes.map((n) => [n.x, n.y]);
}

export function nodeHasHandles(n: BezierNode): boolean {
  return Math.abs(n.inDx) + Math.abs(n.inDy) + Math.abs(n.outDx) + Math.abs(n.outDy) > EPS;
}

export function pathHasCurves(nodes: BezierNode[]): boolean {
  return nodes.some((n) => n.mode !== "none" || nodeHasHandles(n));
}

function cubic(
  p0: [number, number],
  c1: [number, number],
  c2: [number, number],
  p3: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return [
    uu * u * p0[0] + 3 * uu * t * c1[0] + 3 * u * tt * c2[0] + tt * t * p3[0],
    uu * u * p0[1] + 3 * uu * t * c1[1] + 3 * u * tt * c2[1] + tt * t * p3[1],
  ];
}

function segmentControls(a: BezierNode, b: BezierNode): {
  c1: [number, number];
  c2: [number, number];
  straight: boolean;
} {
  const c1: [number, number] = [a.x + a.outDx, a.y + a.outDy];
  const c2: [number, number] = [b.x + b.inDx, b.y + b.inDy];
  const straight =
    Math.abs(a.outDx) + Math.abs(a.outDy) + Math.abs(b.inDx) + Math.abs(b.inDy) < EPS;
  return { c1, c2, straight };
}

export function tessellate(nodes: BezierNode[], closed: boolean, steps = 14): Ring {
  if (nodes.length < 2) return anchors(nodes);
  const n = nodes.length;
  const count = closed ? n : n - 1;
  const out: Ring = [];
  for (let i = 0; i < count; i++) {
    const a = nodes[i];
    const b = nodes[(i + 1) % n];
    const { c1, c2, straight } = segmentControls(a, b);
    out.push([a.x, a.y]);
    if (!straight) {
      for (let s = 1; s < steps; s++) {
        out.push(cubic([a.x, a.y], c1, c2, [b.x, b.y], s / steps));
      }
    }
  }
  if (!closed) out.push([nodes[n - 1].x, nodes[n - 1].y]);
  return out;
}

export function svgPathD(nodes: BezierNode[], closed: boolean): string {
  if (!nodes.length) return "";
  let d = `M${nodes[0].x} ${nodes[0].y}`;
  const n = nodes.length;
  const count = closed ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const a = nodes[i];
    const b = nodes[(i + 1) % n];
    const { c1, c2, straight } = segmentControls(a, b);
    if (straight) d += `L${b.x} ${b.y}`;
    else d += `C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${b.x} ${b.y}`;
  }
  if (closed) d += "Z";
  return d;
}

export function translateBezier(nodes: BezierNode[], dx: number, dy: number): BezierNode[] {
  return nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy }));
}

export function rotateBezier(
  nodes: BezierNode[],
  deg: number,
  origin?: { x: number; y: number },
): BezierNode[] {
  if (!deg || !nodes.length) return nodes;
  let cx = origin?.x ?? 0;
  let cy = origin?.y ?? 0;
  if (!origin) {
    for (const n of nodes) {
      cx += n.x;
      cy += n.y;
    }
    cx /= nodes.length;
    cy /= nodes.length;
  }
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const rot = (x: number, y: number): [number, number] => [x * cos - y * sin, x * sin + y * cos];
  return nodes.map((n) => {
    const [dx, dy] = rot(n.x - cx, n.y - cy);
    const [inDx, inDy] = rot(n.inDx, n.inDy);
    const [outDx, outDy] = rot(n.outDx, n.outDy);
    return { ...n, x: cx + dx, y: cy + dy, inDx, inDy, outDx, outDy };
  });
}

/** Scale a plot in facing-local space so edge labels match `width` × `height`. */
export function scaleShapeToLocalSize(
  obj: { polygon: Ring | null; path?: BezierNode[] | null; facingDeg?: number | null },
  width: number,
  height: number,
): { polygon: Ring; path: BezierNode[] } | null {
  if (!obj.polygon?.length) return null;
  const facing = obj.facingDeg ?? 0;
  const path = objectShape(obj);
  const { x: cx, y: cy } = ringCentroid(obj.polygon);
  const localPath = facing ? rotateBezier(path, -facing, { x: cx, y: cy }) : path;
  const localB = ringBounds(tessellate(localPath, true));
  if (localB.w < EPS || localB.h < EPS) return null;
  const nextB = {
    minX: localB.minX + (localB.w - width) / 2,
    minY: localB.minY + (localB.h - height) / 2,
    maxX: localB.minX + (localB.w - width) / 2 + width,
    maxY: localB.minY + (localB.h - height) / 2 + height,
  };
  const scaled = applyBoundsToBezier(localPath, localB, nextB);
  const world = facing ? rotateBezier(scaled, facing, { x: cx, y: cy }) : scaled;
  return commitShape(world);
}

export function applyBoundsToBezier(
  nodes: BezierNode[],
  start: { minX: number; minY: number; w: number; h: number },
  next: { minX: number; minY: number; maxX: number; maxY: number },
): BezierNode[] {
  const nw = next.maxX - next.minX;
  const nh = next.maxY - next.minY;
  if (start.w < EPS || start.h < EPS) return nodes;
  const sx = nw / start.w;
  const sy = nh / start.h;
  return nodes.map((n) => ({
    ...n,
    x: next.minX + ((n.x - start.minX) / start.w) * nw,
    y: next.minY + ((n.y - start.minY) / start.h) * nh,
    inDx: n.inDx * sx,
    inDy: n.inDy * sy,
    outDx: n.outDx * sx,
    outDy: n.outDy * sy,
  }));
}

export function moveNode(nodes: BezierNode[], index: number, x: number, y: number): BezierNode[] {
  return nodes.map((n, i) => (i === index ? { ...n, x, y } : n));
}

function dropClosingDuplicate(nodes: BezierNode[]): BezierNode[] {
  if (nodes.length < 2) return nodes;
  const a = nodes[0];
  const b = nodes[nodes.length - 1];
  if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) return nodes.slice(0, -1);
  return nodes;
}

/** Four-corner closed path with right angles and no curves. */
export function rectangleCorners(nodes: BezierNode[]): BezierNode[] | null {
  const loop = dropClosingDuplicate(nodes);
  if (loop.length !== 4) return null;
  if (pathHasCurves(loop)) return null;
  for (let i = 0; i < 4; i++) {
    const p = loop[i];
    const prev = loop[(i + 3) % 4];
    const next = loop[(i + 1) % 4];
    const ax = prev.x - p.x;
    const ay = prev.y - p.y;
    const bx = next.x - p.x;
    const by = next.y - p.y;
    const al = Math.hypot(ax, ay);
    const bl = Math.hypot(bx, by);
    if (al < EPS || bl < EPS) return null;
    if (Math.abs((ax * bx + ay * by) / (al * bl)) > 0.04) return null;
  }
  return loop;
}

export function isRectangleShape(nodes: BezierNode[]): boolean {
  return rectangleCorners(nodes) != null;
}

/** Move a rectangle corner and keep opposite corner + right angles. */
export function resizeRectangleCorner(
  nodes: BezierNode[],
  index: number,
  x: number,
  y: number,
  constrain = false,
): BezierNode[] {
  const loop = rectangleCorners(nodes);
  if (!loop) return moveNode(nodes, index, x, y);
  let i = index;
  if (nodes.length === loop.length + 1 && index === nodes.length - 1) i = 0;
  if (i < 0 || i > 3) return moveNode(nodes, index, x, y);

  const opp = loop[(i + 2) % 4];
  const nxt = loop[(i + 1) % 4];
  const prv = loop[(i + 3) % 4];
  let ux = nxt.x - opp.x;
  let uy = nxt.y - opp.y;
  let vx = prv.x - opp.x;
  let vy = prv.y - opp.y;
  const ul = Math.hypot(ux, uy);
  const vl = Math.hypot(vx, vy);
  if (ul < EPS || vl < EPS) return moveNode(nodes, index, x, y);
  ux /= ul;
  uy /= ul;
  vx /= vl;
  vy /= vl;
  let su = (x - opp.x) * ux + (y - opp.y) * uy;
  let sv = (x - opp.x) * vx + (y - opp.y) * vy;
  const min = 0.3;
  if (Math.abs(su) < min) su = su < 0 ? -min : min;
  if (Math.abs(sv) < min) sv = sv < 0 ? -min : min;
  if (constrain && vl > EPS) {
    const aspect = ul / vl;
    sv = (sv < 0 ? -1 : 1) * (Math.abs(su) / aspect);
  }
  const pI = { x: opp.x + su * ux + sv * vx, y: opp.y + su * uy + sv * vy };
  const pNext = { x: opp.x + su * ux, y: opp.y + su * uy };
  const pPrev = { x: opp.x + sv * vx, y: opp.y + sv * vy };
  const out = loop.map((node, k) => {
    if (k === i) return { ...node, x: pI.x, y: pI.y };
    if (k === (i + 1) % 4) return { ...node, x: pNext.x, y: pNext.y };
    if (k === (i + 3) % 4) return { ...node, x: pPrev.x, y: pPrev.y };
    return { ...node };
  });
  if (nodes.length === out.length + 1) return [...out, { ...out[0] }];
  return out;
}

export function dragHandle(
  nodes: BezierNode[],
  index: number,
  which: "in" | "out",
  hx: number,
  hy: number,
  independent: boolean,
): BezierNode[] {
  return nodes.map((n, i) => {
    if (i !== index) return n;
    const dx = hx - n.x;
    const dy = hy - n.y;
    const next = { ...n };
    if (independent) next.mode = "independent";
    else if (next.mode === "none") next.mode = "mirrored";
    const mirror = next.mode !== "independent";
    if (which === "out") {
      next.outDx = dx;
      next.outDy = dy;
      if (mirror) {
        next.inDx = -dx;
        next.inDy = -dy;
        next.mode = "mirrored";
      }
    } else {
      next.inDx = dx;
      next.inDy = dy;
      if (next.mode !== "independent") {
        next.outDx = -dx;
        next.outDy = -dy;
        next.mode = "mirrored";
      }
    }
    return next;
  });
}

export function setMirroredHandles(nodes: BezierNode[], index: number, outDx: number, outDy: number): BezierNode[] {
  return nodes.map((n, i) =>
    i === index
      ? { ...n, outDx, outDy, inDx: -outDx, inDy: -outDy, mode: "mirrored" as const }
      : n,
  );
}

export function toggleSmooth(nodes: BezierNode[], index: number, closed: boolean): BezierNode[] {
  const n = nodes[index];
  if (!n) return nodes;
  if (nodeHasHandles(n) || n.mode !== "none") {
    return nodes.map((node, i) => (i === index ? corner(n.x, n.y) : node));
  }
  const prev = nodes[(index - 1 + nodes.length) % nodes.length];
  const next = nodes[(index + 1) % nodes.length];
  if (!closed && (index === 0 || index === nodes.length - 1)) {
    const other = index === 0 ? next : prev;
    if (!other) return nodes;
    const dx = (other.x - n.x) / 3;
    const dy = (other.y - n.y) / 3;
    return setMirroredHandles(nodes, index, index === 0 ? dx : -dx, index === 0 ? dy : -dy);
  }
  const tx = (next.x - prev.x) / 3;
  const ty = (next.y - prev.y) / 3;
  return setMirroredHandles(nodes, index, tx, ty);
}

export function removeNode(nodes: BezierNode[], index: number, closed: boolean): BezierNode[] | null {
  const min = closed ? 3 : 2;
  if (index < 0 || index >= nodes.length || nodes.length <= min) return null;
  return nodes.filter((_, i) => i !== index);
}

function splitCubic(
  p0: [number, number],
  c1: [number, number],
  c2: [number, number],
  p3: [number, number],
  t: number,
): { a: [[number, number], [number, number], [number, number], [number, number]]; b: [[number, number], [number, number], [number, number], [number, number]] } {
  const lerp = (a: [number, number], b: [number, number], u: number): [number, number] => [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
  ];
  const p01 = lerp(p0, c1, t);
  const p12 = lerp(c1, c2, t);
  const p23 = lerp(c2, p3, t);
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);
  const p0123 = lerp(p012, p123, t);
  return { a: [p0, p01, p012, p0123], b: [p0123, p123, p23, p3] };
}

function closestOnStraight(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x: number,
  y: number,
): { t: number; x: number; y: number; dist: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 < EPS ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return { t, x: px, y: py, dist: Math.hypot(x - px, y - py) };
}

export function closestOnPath(
  nodes: BezierNode[],
  x: number,
  y: number,
  closed: boolean,
  samples = 48,
): { index: number; t: number; x: number; y: number; dist: number } | null {
  if (nodes.length < 2) return null;
  const n = nodes.length;
  const count = closed ? n : n - 1;
  let best: { index: number; t: number; x: number; y: number; dist: number } | null = null;
  for (let i = 0; i < count; i++) {
    const a = nodes[i];
    const b = nodes[(i + 1) % n];
    const { c1, c2, straight } = segmentControls(a, b);
    if (straight) {
      const hit = closestOnStraight(a.x, a.y, b.x, b.y, x, y);
      if (!best || hit.dist < best.dist) best = { index: i, ...hit };
      continue;
    }
    for (let s = 1; s < samples; s++) {
      const t = s / samples;
      const [px, py] = cubic([a.x, a.y], c1, c2, [b.x, b.y], t);
      const dist = Math.hypot(px - x, py - y);
      if (!best || dist < best.dist) best = { index: i, t, x: px, y: py, dist };
    }
  }
  return best;
}

export function insertNode(
  nodes: BezierNode[],
  index: number,
  t: number,
  closed: boolean,
): BezierNode[] {
  const n = nodes.length;
  const a = nodes[index];
  const b = nodes[(index + 1) % n];
  if (!a || !b) return nodes;
  const { c1, c2 } = segmentControls(a, b);
  const split = splitCubic([a.x, a.y], c1, c2, [b.x, b.y], t);
  const left = split.a;
  const right = split.b;
  const mid: BezierNode = {
    x: left[3][0],
    y: left[3][1],
    inDx: left[2][0] - left[3][0],
    inDy: left[2][1] - left[3][1],
    outDx: right[1][0] - right[0][0],
    outDy: right[1][1] - right[0][1],
    mode: "independent",
  };
  const nextA: BezierNode = {
    ...a,
    outDx: left[1][0] - a.x,
    outDy: left[1][1] - a.y,
    mode: a.mode === "none" && (Math.abs(left[1][0] - a.x) + Math.abs(left[1][1] - a.y) > EPS) ? "independent" : a.mode,
  };
  const nextB: BezierNode = {
    ...b,
    inDx: right[2][0] - b.x,
    inDy: right[2][1] - b.y,
    mode: b.mode === "none" && (Math.abs(right[2][0] - b.x) + Math.abs(right[2][1] - b.y) > EPS) ? "independent" : b.mode,
  };
  const out = nodes.slice();
  nextA.mode = pathHasCurves([nextA]) ? (nextA.mode === "none" ? "independent" : nextA.mode) : "none";
  nextB.mode = pathHasCurves([nextB]) ? (nextB.mode === "none" ? "independent" : nextB.mode) : "none";
  out[index] = nextA;
  out[(index + 1) % n] = nextB;
  out.splice(index + 1, 0, mid);
  void closed;
  return out;
}

export function parseSvgPath(d: string): { nodes: BezierNode[]; closed: boolean } | null {
  const tokens = tokenizePath(d);
  if (!tokens.length) return null;
  const nodes: BezierNode[] = [];
  let closed = false;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let lastC2: [number, number] | null = null;
  let i = 0;

  const abs = (cmd: string, x: number, y: number): [number, number] =>
    cmd === cmd.toLowerCase() ? [cx + x, cy + y] : [x, y];

  const ensureNode = () => {
    if (!nodes.length || nodes[nodes.length - 1].x !== cx || nodes[nodes.length - 1].y !== cy) {
      nodes.push(corner(cx, cy));
    }
  };

  while (i < tokens.length) {
    const tok = tokens[i];
    if (typeof tok !== "string") return null;
    const cmd = tok;
    i += 1;
    const nums: number[] = [];
    while (i < tokens.length && typeof tokens[i] === "number") {
      nums.push(tokens[i] as number);
      i += 1;
    }
    const up = cmd.toUpperCase();
    if (up === "Z") {
      closed = true;
      lastC2 = null;
      continue;
    }
    if (up === "M") {
      for (let k = 0; k + 1 < nums.length; k += 2) {
        const [x, y] = abs(cmd, nums[k], nums[k + 1]);
        cx = x;
        cy = y;
        if (k === 0) {
          sx = cx;
          sy = cy;
          nodes.push(corner(cx, cy));
        } else {
          ensureNode();
          nodes.push(corner(cx, cy));
        }
        lastC2 = null;
      }
      continue;
    }
    if (up === "L") {
      for (let k = 0; k + 1 < nums.length; k += 2) {
        const [x, y] = abs(cmd, nums[k], nums[k + 1]);
        ensureNode();
        cx = x;
        cy = y;
        nodes.push(corner(cx, cy));
        lastC2 = null;
      }
      continue;
    }
    if (up === "H") {
      for (const n of nums) {
        cx = cmd === "h" ? cx + n : n;
        ensureNode();
        nodes.push(corner(cx, cy));
        lastC2 = null;
      }
      continue;
    }
    if (up === "V") {
      for (const n of nums) {
        cy = cmd === "v" ? cy + n : n;
        ensureNode();
        nodes.push(corner(cx, cy));
        lastC2 = null;
      }
      continue;
    }
    if (up === "C") {
      for (let k = 0; k + 5 < nums.length; k += 6) {
        const [x1, y1] = abs(cmd, nums[k], nums[k + 1]);
        const [x2, y2] = abs(cmd, nums[k + 2], nums[k + 3]);
        const [x, y] = abs(cmd, nums[k + 4], nums[k + 5]);
        ensureNode();
        const a = nodes[nodes.length - 1];
        a.outDx = x1 - a.x;
        a.outDy = y1 - a.y;
        a.mode = "independent";
        cx = x;
        cy = y;
        nodes.push({
          x: cx,
          y: cy,
          inDx: x2 - x,
          inDy: y2 - y,
          outDx: 0,
          outDy: 0,
          mode: "independent",
        });
        lastC2 = [x2, y2];
      }
      continue;
    }
    if (up === "S") {
      for (let k = 0; k + 3 < nums.length; k += 4) {
        const [x2, y2] = abs(cmd, nums[k], nums[k + 1]);
        const [x, y] = abs(cmd, nums[k + 2], nums[k + 3]);
        ensureNode();
        const a = nodes[nodes.length - 1];
        const rx = lastC2 ? 2 * a.x - lastC2[0] : a.x;
        const ry = lastC2 ? 2 * a.y - lastC2[1] : a.y;
        a.outDx = rx - a.x;
        a.outDy = ry - a.y;
        a.mode = "independent";
        cx = x;
        cy = y;
        nodes.push({
          x: cx,
          y: cy,
          inDx: x2 - x,
          inDy: y2 - y,
          outDx: 0,
          outDy: 0,
          mode: "independent",
        });
        lastC2 = [x2, y2];
      }
      continue;
    }
    if (up === "Q") {
      for (let k = 0; k + 3 < nums.length; k += 4) {
        const [qx, qy] = abs(cmd, nums[k], nums[k + 1]);
        const [x, y] = abs(cmd, nums[k + 2], nums[k + 3]);
        ensureNode();
        const a = nodes[nodes.length - 1];
        const c1x = a.x + (2 / 3) * (qx - a.x);
        const c1y = a.y + (2 / 3) * (qy - a.y);
        const c2x = x + (2 / 3) * (qx - x);
        const c2y = y + (2 / 3) * (qy - y);
        a.outDx = c1x - a.x;
        a.outDy = c1y - a.y;
        a.mode = "independent";
        cx = x;
        cy = y;
        nodes.push({
          x: cx,
          y: cy,
          inDx: c2x - x,
          inDy: c2y - y,
          outDx: 0,
          outDy: 0,
          mode: "independent",
        });
        lastC2 = [c2x, c2y];
      }
      continue;
    }
    if (up === "T") {
      for (let k = 0; k + 1 < nums.length; k += 2) {
        const [x, y] = abs(cmd, nums[k], nums[k + 1]);
        ensureNode();
        const a = nodes[nodes.length - 1];
        const qx = lastC2 ? 2 * a.x - lastC2[0] : a.x;
        const qy = lastC2 ? 2 * a.y - lastC2[1] : a.y;
        const c1x = a.x + (2 / 3) * (qx - a.x);
        const c1y = a.y + (2 / 3) * (qy - a.y);
        const c2x = x + (2 / 3) * (qx - x);
        const c2y = y + (2 / 3) * (qy - y);
        a.outDx = c1x - a.x;
        a.outDy = c1y - a.y;
        a.mode = "independent";
        cx = x;
        cy = y;
        nodes.push({
          x: cx,
          y: cy,
          inDx: c2x - x,
          inDy: c2y - y,
          outDx: 0,
          outDy: 0,
          mode: "independent",
        });
        lastC2 = [c2x, c2y];
      }
      continue;
    }
    if (up === "A") return null;
  }
  if (closed && nodes.length > 1) {
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < EPS) {
      first.inDx = last.inDx;
      first.inDy = last.inDy;
      if (pathHasCurves([last])) first.mode = first.mode === "none" ? last.mode : first.mode;
      nodes.pop();
    }
  }
  inferMirror(nodes);
  return nodes.length ? { nodes, closed } : null;
}

function inferMirror(nodes: BezierNode[]) {
  for (const n of nodes) {
    if (n.mode === "none") continue;
    if (Math.abs(n.inDx + n.outDx) < 1e-4 && Math.abs(n.inDy + n.outDy) < 1e-4 && pathHasCurves([n])) {
      n.mode = "mirrored";
    }
  }
}

function tokenizePath(d: string): (string | number)[] {
  const out: (string | number)[] = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    if (m[1]) out.push(m[1]);
    else out.push(Number(m[2]));
  }
  return out;
}

type StoredBezier = { t: "bz"; n: number[][] };

export function serializePolygon(polygon: Ring | null, path: BezierNode[] | null | undefined): unknown {
  if (path && pathHasCurves(path)) {
    const stored: StoredBezier = {
      t: "bz",
      n: path.map((n) => [
        n.x,
        n.y,
        n.inDx,
        n.inDy,
        n.outDx,
        n.outDy,
        n.mode === "mirrored" ? 1 : n.mode === "independent" ? 2 : 0,
      ]),
    };
    return stored;
  }
  return polygon;
}

export function parseStoredPolygon(raw: unknown): { polygon: Ring | null; path: BezierNode[] | null } {
  if (!raw) return { polygon: null, path: null };
  if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) {
    const ring = raw as Ring;
    return { polygon: ring, path: fromRing(ring) };
  }
  if (typeof raw === "object" && raw && (raw as StoredBezier).t === "bz") {
    const rows = (raw as StoredBezier).n ?? [];
    const path: BezierNode[] = rows.map((r) => ({
      x: r[0] ?? 0,
      y: r[1] ?? 0,
      inDx: r[2] ?? 0,
      inDy: r[3] ?? 0,
      outDx: r[4] ?? 0,
      outDy: r[5] ?? 0,
      mode: r[6] === 1 ? "mirrored" : r[6] === 2 ? "independent" : "none",
    }));
    return { polygon: tessellate(path, true), path };
  }
  return { polygon: null, path: null };
}

export function objectShape(obj: { polygon: Ring | null; path?: BezierNode[] | null }): BezierNode[] {
  if (obj.path?.length) return obj.path;
  if (obj.polygon?.length) return fromRing(obj.polygon);
  return [];
}

export function commitShape(path: BezierNode[], closed = true): { polygon: Ring; path: BezierNode[] } {
  return { polygon: tessellate(path, closed), path };
}

/** Cubic Bézier ellipse (κ ≈ 0.5523). */
export function ellipseBezier(cx: number, cy: number, rx: number, ry: number): BezierNode[] {
  const kx = Math.max(0, rx) * 0.5522847498307936;
  const ky = Math.max(0, ry) * 0.5522847498307936;
  return [
    { x: cx + rx, y: cy, inDx: 0, inDy: -ky, outDx: 0, outDy: ky, mode: "mirrored" },
    { x: cx, y: cy + ry, inDx: kx, inDy: 0, outDx: -kx, outDy: 0, mode: "mirrored" },
    { x: cx - rx, y: cy, inDx: 0, inDy: ky, outDx: 0, outDy: -ky, mode: "mirrored" },
    { x: cx, y: cy - ry, inDx: -kx, inDy: 0, outDx: kx, outDy: 0, mode: "mirrored" },
  ];
}

export function ellipseFromCorners(x0: number, y0: number, x1: number, y1: number): BezierNode[] {
  const minX = Math.min(x0, x1);
  const minY = Math.min(y0, y1);
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);
  return ellipseBezier(minX + w / 2, minY + h / 2, w / 2, h / 2);
}
