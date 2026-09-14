import { DEFAULT_HALL_VIEW, type HallView } from "@/lib/hall-view";
import type { ViewMode } from "@/lib/types";

export type MapViewPrefs = {
  viewMode: ViewMode;
  hallView: HallView;
  hallSettingsOpen: boolean;
  showGrid: boolean;
  showRulers: boolean;
  showUnderlay: boolean;
  showObjectSizes: boolean;
  floorId: string;
};

export const DEFAULT_MAP_VIEW_PREFS: MapViewPrefs = {
  viewMode: "plan",
  hallView: DEFAULT_HALL_VIEW,
  hallSettingsOpen: false,
  showGrid: true,
  showRulers: false,
  showUnderlay: true,
  showObjectSizes: false,
  floorId: "",
};

export type FloorRef = { id: string; name: string };

const HALL_BOOL: { param: string; key: keyof HallView }[] = [
  { param: "ortho", key: "orthographic" },
  { param: "cuboids", key: "cuboids" },
  { param: "fog", key: "fog" },
  { param: "ao", key: "ao" },
  { param: "shadows", key: "shadows" },
  { param: "env", key: "environment" },
  { param: "pt", key: "pathTracing" },
];

const HALL_NUM: { param: string; key: keyof HallView }[] = [
  { param: "az", key: "azimuth" },
  { param: "el", key: "elevation" },
  { param: "dist", key: "distance" },
  { param: "sun", key: "lightAzimuth" },
  { param: "sunEl", key: "lightElevation" },
  { param: "sunDist", key: "lightDistance" },
  { param: "light", key: "lightIntensity" },
  { param: "fill", key: "fill" },
  { param: "fogI", key: "fogIntensity" },
];

export const MAP_VIEW_PARAM_KEYS = [
  "view",
  "floor",
  "sizes",
  "grid",
  "rulers",
  "underlay",
  "panel",
  ...HALL_BOOL.map((x) => x.param),
  ...HALL_NUM.map((x) => x.param),
] as const;

function parseBool(raw: string | null): boolean | undefined {
  if (raw == null) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "" || v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return undefined;
}

function parseNum(raw: string | null): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function floorSlug(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

export function resolveFloorId(raw: string, floors: FloorRef[]): string | undefined {
  const t = raw.trim().toLowerCase();
  if (!t || !floors.length) return undefined;
  const byId = floors.find((f) => f.id.toLowerCase() === t);
  if (byId) return byId.id;
  const byName = floors.find((f) => f.name.trim().toLowerCase() === t);
  if (byName) return byName.id;
  const bySlug = floors.find((f) => floorSlug(f.name) === t || floorSlug(f.name) === floorSlug(raw));
  return bySlug?.id;
}

function floorParamValue(floorId: string, floors: FloorRef[]): string {
  const floor = floors.find((f) => f.id === floorId);
  if (!floor?.name.trim()) return floorId;
  const slug = floorSlug(floor.name);
  const unique = floors.filter((f) => floorSlug(f.name) === slug).length === 1;
  return unique ? slug : floorId;
}

function parseViewMode(raw: string | null): ViewMode | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "3d" || v === "hall") return "hall";
  if (v === "2d" || v === "plan") return "plan";
  return undefined;
}

export function parseMapViewSearch(
  search: string | URLSearchParams,
  floors: FloorRef[] = [],
): Partial<MapViewPrefs> {
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  const next: Partial<MapViewPrefs> = {};
  const viewMode = parseViewMode(params.get("view"));
  if (viewMode) next.viewMode = viewMode;
  const floorRaw = params.get("floor");
  if (floorRaw) {
    const id = resolveFloorId(floorRaw, floors);
    if (id) next.floorId = id;
  }
  const sizes = parseBool(params.get("sizes"));
  if (sizes != null) next.showObjectSizes = sizes;
  const grid = parseBool(params.get("grid"));
  if (grid != null) next.showGrid = grid;
  const rulers = parseBool(params.get("rulers"));
  if (rulers != null) next.showRulers = rulers;
  const underlay = parseBool(params.get("underlay"));
  if (underlay != null) next.showUnderlay = underlay;
  const panel = parseBool(params.get("panel"));
  if (panel != null) next.hallSettingsOpen = panel;

  const hall: Partial<HallView> = {};
  for (const { param, key } of HALL_BOOL) {
    const v = parseBool(params.get(param));
    if (v != null) (hall as Record<string, boolean>)[key] = v;
  }
  for (const { param, key } of HALL_NUM) {
    const v = parseNum(params.get(param));
    if (v != null) (hall as Record<string, number>)[key] = v;
  }
  if (Object.keys(hall).length) next.hallView = hall as HallView;
  return next;
}

export function writeMapViewSearch(
  params: URLSearchParams,
  prefs: MapViewPrefs,
  opts: { defaultFloorId?: string; floors?: FloorRef[] } = {},
) {
  for (const key of MAP_VIEW_PARAM_KEYS) params.delete(key);
  params.set("view", prefs.viewMode === "hall" ? "3d" : "2d");
  const floors = opts.floors ?? [];
  if (prefs.floorId && prefs.floorId !== opts.defaultFloorId) {
    params.set("floor", floorParamValue(prefs.floorId, floors));
  }
  if (prefs.showObjectSizes !== DEFAULT_MAP_VIEW_PREFS.showObjectSizes) {
    params.set("sizes", prefs.showObjectSizes ? "1" : "0");
  }
  if (prefs.showGrid !== DEFAULT_MAP_VIEW_PREFS.showGrid) params.set("grid", prefs.showGrid ? "1" : "0");
  if (prefs.showRulers !== DEFAULT_MAP_VIEW_PREFS.showRulers) params.set("rulers", prefs.showRulers ? "1" : "0");
  if (prefs.showUnderlay !== DEFAULT_MAP_VIEW_PREFS.showUnderlay) {
    params.set("underlay", prefs.showUnderlay ? "1" : "0");
  }
  if (prefs.hallSettingsOpen) params.set("panel", "1");
  for (const { param, key } of HALL_BOOL) {
    const value = prefs.hallView[key];
    if (value !== DEFAULT_HALL_VIEW[key]) params.set(param, value ? "1" : "0");
  }
  for (const { param, key } of HALL_NUM) {
    const value = prefs.hallView[key];
    if (value !== DEFAULT_HALL_VIEW[key]) params.set(param, String(value));
  }
}

export function replaceMapViewUrl(prefs: MapViewPrefs, opts: { defaultFloorId?: string; floors?: FloorRef[] } = {}) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  writeMapViewSearch(url.searchParams, prefs, opts);
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === next) return;
  window.history.replaceState(window.history.state, "", next);
}
