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
