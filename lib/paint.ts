export type PaintChannel = string;

export type ShapePaint = {
  fill: string | null;
  fillOpacity: number;
  stroke: string | null;
  strokeOpacity: number;
  strokeWidth: number;
  opacity: number;
};

export const DEFAULT_SHAPE_PAINT: ShapePaint = {
  fill: null,
  fillOpacity: 1,
  stroke: null,
  strokeOpacity: 1,
  strokeWidth: 0,
  opacity: 1,
};

export function paintIsNone(value: string | null | undefined): boolean {
  if (value == null) return false;
  const v = value.trim().toLowerCase();
  return v === "" || v === "none" || v === "transparent";
}

export function paintToHex(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(0, 7);
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
  }
  return fallback;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

function parseChannel(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return v ? v : null;
}

export function parseShapePaint(raw: unknown, fallback: ShapePaint = DEFAULT_SHAPE_PAINT): ShapePaint {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const p = raw as Record<string, unknown>;
  const fill = parseChannel(p.fill);
  const stroke = parseChannel(p.stroke);
  return {
    fill: fill === undefined ? fallback.fill : fill,
    fillOpacity: p.fillOpacity == null ? fallback.fillOpacity : clamp01(Number(p.fillOpacity)),
    stroke: stroke === undefined ? fallback.stroke : stroke,
    strokeOpacity: p.strokeOpacity == null ? fallback.strokeOpacity : clamp01(Number(p.strokeOpacity)),
    strokeWidth:
      p.strokeWidth == null ? fallback.strokeWidth : Math.max(0, Number(p.strokeWidth) || 0),
    opacity: p.opacity == null ? fallback.opacity : clamp01(Number(p.opacity)),
  };
}

export function mergeShapePaint(base: ShapePaint, patch: Partial<ShapePaint>): ShapePaint {
  return parseShapePaint({ ...base, ...patch }, base);
}

export function hexLuminance(hex: string): number {
  const h = paintToHex(hex, "#000000");
  const n = Number.parseInt(h.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastingGlyph(fillHex: string): string {
  return hexLuminance(fillHex) > 0.45 ? "#0a0a0a" : "#fcfcfc";
}

export const THEME_ICON_FILL = "var(--map-icon-fill)";
export const THEME_ICON_GLYPH = "var(--map-icon-glyph)";

export function themeIconFillHex(tone: "light" | "dark"): string {
  return tone === "light" ? "#fcfcfc" : "#0a0a0a";
}

export function resolvedIconPaint(
  paint: ShapePaint | null | undefined,
  color: string | null | undefined,
  tone: "light" | "dark" = "dark",
): {
  fill: string;
  fillNone: boolean;
  fillHex: string;
  fillOpacity: number;
  stroke: string;
  strokeNone: boolean;
  strokeHex: string;
  strokeOpacity: number;
  strokeWidth: number;
  opacity: number;
  glyph: string;
  glyphHex: string;
} {
  const p = parseShapePaint(paint);
  const override = p.fill ?? color;
  const fillNone = paintIsNone(override);
  const fillHex = fillNone
    ? themeIconFillHex(tone)
    : override && !override.startsWith("var(")
      ? paintToHex(override, themeIconFillHex(tone))
      : themeIconFillHex(tone);
  const fill = fillNone ? "none" : override && /^#|^rgb/.test(override) ? fillHex : THEME_ICON_FILL;
  const strokeNone = p.stroke == null || paintIsNone(p.stroke) || p.strokeWidth <= 0;
  const strokeHex = strokeNone ? themeIconFillHex(tone) : paintToHex(p.stroke, "#0a0a0a");
  const glyphHex = contrastingGlyph(fillHex);
  return {
    fill,
    fillNone,
    fillHex,
    fillOpacity: p.fillOpacity,
    stroke: strokeNone ? "none" : strokeHex,
    strokeNone,
    strokeHex,
    strokeOpacity: p.strokeOpacity,
    strokeWidth: strokeNone ? 0 : p.strokeWidth,
    opacity: p.opacity,
    glyph: fill === THEME_ICON_FILL ? THEME_ICON_GLYPH : glyphHex,
    glyphHex,
  };
}
