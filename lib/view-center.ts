export type ViewCenter = { x: number; y: number };

export function normalizeViewCenter(raw: unknown): ViewCenter | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function frameAroundViewCenter(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  center: ViewCenter | null,
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!center) return bounds;
  const halfW = Math.max(center.x - bounds.minX, bounds.maxX - center.x, 0.25);
  const halfH = Math.max(center.y - bounds.minY, bounds.maxY - center.y, 0.25);
  return {
    minX: center.x - halfW,
    minY: center.y - halfH,
    maxX: center.x + halfW,
    maxY: center.y + halfH,
  };
}

/** World span so isometric framing covers `bounds` while looking at `center`. */
export function spanToFitBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  center: ViewCenter | null,
): number {
  const cx = center?.x ?? (bounds.minX + bounds.maxX) / 2;
  const cy = center?.y ?? (bounds.minY + bounds.maxY) / 2;
  const w = 2 * Math.max(Math.abs(cx - bounds.minX), Math.abs(bounds.maxX - cx), 0.25);
  const h = 2 * Math.max(Math.abs(cy - bounds.minY), Math.abs(bounds.maxY - cy), 0.25);
  // isometricPose uses ~0.85×span; 1.55× keeps the full plan inside a 42° FOV.
  return Math.max(w, h, 20) * 1.55;
}
