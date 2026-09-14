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
  const w = Math.max(0.5, bounds.maxX - bounds.minX);
  const h = Math.max(0.5, bounds.maxY - bounds.minY);
  return {
    minX: center.x - w / 2,
    minY: center.y - h / 2,
    maxX: center.x + w / 2,
    maxY: center.y + h / 2,
  };
}
