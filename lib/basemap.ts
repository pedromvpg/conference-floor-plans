import type { FloorBasemap } from "./types";

export const DEFAULT_FLOOR_BASEMAP: FloorBasemap = {
  enabled: true,
  lat: 22.3215,
  lng: 114.1734,
  zoom: 16,
  opacity: 0.85,
  bearing: 0,
};

export function normalizeFloorBasemap(raw: FloorBasemap | null | undefined): FloorBasemap | null {
  if (!raw) return null;
  const bearing = Number(raw.bearing);
  return {
    enabled: Boolean(raw.enabled),
    lat: raw.lat,
    lng: raw.lng,
    zoom: raw.zoom,
    opacity: Number.isFinite(raw.opacity) ? raw.opacity : DEFAULT_FLOOR_BASEMAP.opacity,
    bearing: Number.isFinite(bearing) ? bearing : 0,
  };
}

export function wrapBearingDeg(deg: number) {
  if (!Number.isFinite(deg)) return 0;
  const w = ((deg % 360) + 360) % 360;
  return Math.round(w * 10) / 10;
}

/** ~1.1 m of latitude; longitude is similar near 22°. */
export const BASEMAP_COORD_STEP = 0.00001;

export function roundBasemapCoord(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

/** Parse a pasted "lat, lng" (or "lng, lat") pair into both coordinates. */
export function parseLatLngPaste(raw: string): { lat: number; lng: number } | null {
  const nums = raw.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const a = Number(nums[0]);
  const b = Number(nums[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
    return { lat: roundBasemapCoord(a), lng: roundBasemapCoord(b) };
  }
  if (Math.abs(b) <= 90 && Math.abs(a) <= 180) {
    return { lat: roundBasemapCoord(b), lng: roundBasemapCoord(a) };
  }
  return null;
}

/** Map 0–360° to the −180…180 slider. */
export function bearingSliderValue(deg: number) {
  const w = wrapBearingDeg(deg);
  return w > 180 ? w - 360 : w;
}

/** EPSG:3857 equator circumference (metres). */
export const EARTH_CIRCUMFERENCE_M = 40075016.68557849;
/** MapLibre camera world size at zoom 0, in CSS pixels. */
export const MAPLIBRE_TILE_SIZE = 512;

export function lngLatToMercator(lng: number, lat: number) {
  const clampedLat = Math.max(-85.051128, Math.min(85.051128, lat));
  const x = (lng + 180) / 360;
  const sin = Math.sin((clampedLat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  return { x, y };
}

export function mercatorToLngLat(x: number, y: number) {
  const lng = x * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

export function meterInMercatorUnits(lat: number) {
  return 1 / (EARTH_CIRCUMFERENCE_M * Math.max(Math.cos((lat * Math.PI) / 180), 1e-6));
}

/** Web Mercator metres per CSS pixel at a latitude and MapLibre zoom. */
export function webMercatorMetersPerPx(lat: number, zoom: number): number {
  const cos = Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
  return (cos * EARTH_CIRCUMFERENCE_M) / (MAPLIBRE_TILE_SIZE * 2 ** zoom);
}

export function leafletZoomForMetersPerPx(lat: number, metersPerPx: number): number {
  const cos = Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
  const z = Math.log2((cos * EARTH_CIRCUMFERENCE_M) / (MAPLIBRE_TILE_SIZE * Math.max(metersPerPx, 1e-9)));
  if (!Number.isFinite(z)) return 16;
  return Math.min(24, Math.max(0, z));
}

/** Zoom delta so a map-screen span matches the same floor span on the SVG. */
export function zoomDeltaToMatchSpan(mapPx: number, svgPx: number): number {
  if (!(mapPx > 0.5) || !(svgPx > 0.5)) return 0;
  const dz = Math.log2(mapPx / svgPx);
  return Number.isFinite(dz) ? dz : 0;
}

export function offsetLatLng(lat: number, lng: number, eastM: number, northM: number) {
  const a = lngLatToMercator(lng, lat);
  const m = meterInMercatorUnits(lat);
  return mercatorToLngLat(a.x + eastM * m, a.y - northM * m);
}

export function enuFromLngLat(originLat: number, originLng: number, lat: number, lng: number) {
  const a = lngLatToMercator(originLng, originLat);
  const b = lngLatToMercator(lng, lat);
  const meters = 1 / meterInMercatorUnits(originLat);
  return { east: (b.x - a.x) * meters, north: (a.y - b.y) * meters };
}

/** Floor +X / +Y (y down) → east/north when the map's "up" is `bearingDeg` (0 = north). */
export function floorDeltaToEnu(dx: number, dy: number, bearingDeg: number) {
  const β = (bearingDeg * Math.PI) / 180;
  const c = Math.cos(β);
  const s = Math.sin(β);
  return {
    east: dx * c - dy * s,
    north: -dx * s - dy * c,
  };
}

/** `lat`/`lng` is the WGS84 position of floor point `(anchorX, anchorY)` (y down). */
export function leafletViewFromPlan(opts: {
  anchorLat: number;
  anchorLng: number;
  anchorX: number;
  anchorY: number;
  cam: { x: number; y: number; w: number; h: number };
  metersPerPx: number;
  bearingDeg?: number;
}) {
  const dx = opts.cam.x + opts.cam.w / 2 - opts.anchorX;
  const dy = opts.cam.y + opts.cam.h / 2 - opts.anchorY;
  const bearing = opts.bearingDeg ?? 0;
  const { east, north } = floorDeltaToEnu(dx, dy, bearing);
  const center = offsetLatLng(opts.anchorLat, opts.anchorLng, east, north);
  return {
    lat: center.lat,
    lng: center.lng,
    zoom: leafletZoomForMetersPerPx(center.lat, opts.metersPerPx),
    bearing,
    east,
    north,
  };
}

export function anchorFromLeafletCenter(opts: {
  centerLat: number;
  centerLng: number;
  east: number;
  north: number;
}) {
  return offsetLatLng(opts.centerLat, opts.centerLng, -opts.east, -opts.north);
}
