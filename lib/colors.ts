export type MapTone = "light" | "dark";

export function tierFill(tier: string): string {
  const hue = tierHue(tier);
  if (hue == null) return `hsla(24, 94%, var(--map-geom-l), var(--map-geom-a))`;
  return `hsla(${hue}, 38%, var(--map-geom-l), var(--map-geom-a))`;
}

export function boothFillHex(color: string | null, tier: string, tone: MapTone = "dark"): string {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const hue = tierHue(tier);
  if (hue == null) return tone === "light" ? "#f4a574" : "#f97316";
  return hslToHex(hue, tone === "light" ? 36 : 42, tone === "light" ? 64 : 42);
}

function tierHue(tier: string): number | null {
  if (!tier) return null;
  let h = 0;
  for (let i = 0; i < tier.length; i++) h = (h * 31 + tier.charCodeAt(i)) >>> 0;
  return h % 360;
}

export const HALL_THEME = {
  light: {
    bg: "#f4f4f1",
    floor: "#e4e4de",
    grid: "#c4c4bc",
    sky: "#ffffff",
    ground: "#d4d4ce",
  },
  dark: {
    bg: "#12110f",
    floor: "#161410",
    grid: "#3a342c",
    sky: "#fff1e0",
    ground: "#1a1612",
  },
} as const;

export function darkenHex(hex: string, amount = 0.28): string {
  const n = parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return "#1a1a1a";
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lig - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
