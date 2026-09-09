import type { Units } from "./types";

export const METERS_PER_FOOT = 0.3048;

export function toMeters(value: number, units: Units): number {
  return units === "ft" ? value * METERS_PER_FOOT : value;
}

export function fromMeters(meters: number, units: Units): number {
  return units === "ft" ? meters / METERS_PER_FOOT : meters;
}

export function formatLength(meters: number, units: Units, digits = 1): string {
  const v = fromMeters(meters, units);
  const n = Number.isInteger(v) ? String(v) : v.toFixed(digits);
  return `${n} ${units}`;
}

export function formatSize(widthM: number, depthM: number, units: Units, digits = 1): string {
  const w = fromMeters(widthM, units);
  const d = fromMeters(depthM, units);
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(digits));
  return `${n(w)} × ${n(d)} ${units}`;
}

export function formatArea(squareMeters: number, units: Units, digits = 1): string {
  const v = units === "ft" ? squareMeters / METERS_PER_FOOT ** 2 : squareMeters;
  const n = Number.isInteger(v) ? String(v) : v.toFixed(digits);
  return `${n} ${units}²`;
}

export const PRESETS: { id: string; label: string; w: number; d: number; units: Units }[] = [
  { id: "3x3m", label: "3 × 3 m", w: 3, d: 3, units: "m" },
  { id: "6x6m", label: "6 × 6 m", w: 6, d: 6, units: "m" },
  { id: "10x10m", label: "10 × 10 m", w: 10, d: 10, units: "m" },
  { id: "10x10ft", label: "10 × 10 ft", w: 10, d: 10, units: "ft" },
  { id: "20x20ft", label: "20 × 20 ft", w: 20, d: 20, units: "ft" },
];

export function presetMeters(id: string): { w: number; d: number } | null {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return null;
  return { w: toMeters(p.w, p.units), d: toMeters(p.d, p.units) };
}

export function snap(value: number, grid: number): number {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

export function gridSize(units: Units): number {
  return units === "ft" ? METERS_PER_FOOT : 1;
}

/** Finer snap when zoomed in so booths can meet underlay lines. */
export function editSnapMeters(units: Units, pxPerMeter: number): number {
  const base = gridSize(units);
  if (pxPerMeter >= 36) return base / 10;
  if (pxPerMeter >= 14) return base / 2;
  return base;
}

function niceNumber(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const n = raw / mag;
  const mul = n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10;
  return mag * mul;
}

/** Major ruler spacing in metres so ticks stay readable. */
export function rulerStepMeters(units: Units, pxPerMeter: number, targetPx = 72): number {
  const displayPerMeter = units === "ft" ? 1 / METERS_PER_FOOT : 1;
  const rawDisplay = (displayPerMeter / Math.max(pxPerMeter, 1e-9)) * targetPx;
  return niceNumber(rawDisplay) / displayPerMeter;
}

export function rulerStepFromSpan(spanMeters: number, units: Units, targetTicks = 8): number {
  const displayPerMeter = units === "ft" ? 1 / METERS_PER_FOOT : 1;
  return niceNumber((spanMeters * displayPerMeter) / Math.max(targetTicks, 1)) / displayPerMeter;
}

export function rulerTicks(min: number, max: number, step: number): number[] {
  if (!(step > 0) || max <= min) return [];
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 1e-6; v += step) out.push(Number(v.toFixed(8)));
  return out;
}
