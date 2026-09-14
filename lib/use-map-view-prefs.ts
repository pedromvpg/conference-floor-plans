"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_HALL_VIEW, type HallView } from "@/lib/hall-view";
import {
  DEFAULT_MAP_VIEW_PREFS,
  parseMapViewSearch,
  replaceMapViewUrl,
  type FloorRef,
  type MapViewPrefs,
} from "@/lib/map-view-url";
import type { ViewMode } from "@/lib/types";

export type { MapViewPrefs };
export { DEFAULT_MAP_VIEW_PREFS };

const KEY_PREFIX = "conference-floor-plans-view:";

function storageKey(slug: string) {
  return `${KEY_PREFIX}${slug}`;
}

function asBool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asNum(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseHallView(raw: unknown): HallView {
  const d = DEFAULT_HALL_VIEW;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  return {
    orthographic: asBool(o.orthographic, d.orthographic),
    cuboids: asBool(o.cuboids, d.cuboids),
    fog: asBool(o.fog, d.fog),
    fogIntensity: asNum(o.fogIntensity, d.fogIntensity),
    ao: asBool(o.ao, d.ao),
    shadows: asBool(o.shadows, d.shadows),
    environment: asBool(o.environment, d.environment),
    pathTracing: asBool(o.pathTracing, d.pathTracing),
    azimuth: asNum(o.azimuth, d.azimuth),
    elevation: asNum(o.elevation, d.elevation),
    distance: asNum(o.distance, d.distance),
    lightAzimuth: asNum(o.lightAzimuth, d.lightAzimuth),
    lightElevation: asNum(o.lightElevation, d.lightElevation),
    lightDistance: asNum(o.lightDistance, d.lightDistance),
    lightIntensity: asNum(o.lightIntensity, d.lightIntensity),
    fill: asNum(o.fill, d.fill),
  };
}

function parsePrefs(raw: string | null): Partial<MapViewPrefs> | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    const next: Partial<MapViewPrefs> = {};
    if (o.viewMode === "plan" || o.viewMode === "hall") next.viewMode = o.viewMode;
    if (o.hallView) next.hallView = parseHallView(o.hallView);
    if (typeof o.hallSettingsOpen === "boolean") next.hallSettingsOpen = o.hallSettingsOpen;
    if (typeof o.showGrid === "boolean") next.showGrid = o.showGrid;
    if (typeof o.showRulers === "boolean") next.showRulers = o.showRulers;
    if (typeof o.showUnderlay === "boolean") next.showUnderlay = o.showUnderlay;
    if (typeof o.showObjectSizes === "boolean") next.showObjectSizes = o.showObjectSizes;
    if (typeof o.floorId === "string") next.floorId = o.floorId;
    return next;
  } catch {
    return null;
  }
}

function loadPrefs(slug: string): Partial<MapViewPrefs> | null {
  try {
    return parsePrefs(localStorage.getItem(storageKey(slug)));
  } catch {
    return null;
  }
}

function savePrefs(slug: string, prefs: MapViewPrefs) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(prefs));
  } catch {
    /* quota / private mode */
  }
}

export function useMapViewPrefs(
  slug: string,
  initialFloorId = "",
  fallbackViewMode: ViewMode | "desktop-hall" = "plan",
  floors: FloorRef[] = [],
) {
  const [prefs, setPrefs] = useState<MapViewPrefs>({
    ...DEFAULT_MAP_VIEW_PREFS,
    floorId: initialFloorId,
  });
  const [hydrated, setHydrated] = useState(false);
  const [scope, setScope] = useState(slug);
  const floorsRef = useRef(floors);
  floorsRef.current = floors;
  if (scope !== slug) {
    setScope(slug);
    setHydrated(false);
    setPrefs({ ...DEFAULT_MAP_VIEW_PREFS, floorId: initialFloorId });
  }

  useEffect(() => {
    const stored = loadPrefs(slug);
    const fromUrl = parseMapViewSearch(window.location.search, floorsRef.current);
    const desktopHall =
      fallbackViewMode === "desktop-hall" && window.matchMedia("(min-width: 768px)").matches;
    setPrefs({
      ...DEFAULT_MAP_VIEW_PREFS,
      viewMode: desktopHall ? "hall" : fallbackViewMode === "desktop-hall" ? "plan" : fallbackViewMode,
      ...stored,
      ...fromUrl,
      hallView: {
        ...DEFAULT_MAP_VIEW_PREFS.hallView,
        ...stored?.hallView,
        ...fromUrl.hallView,
      },
      floorId: fromUrl.floorId || stored?.floorId || initialFloorId,
    });
    setHydrated(true);
  }, [slug, fallbackViewMode, initialFloorId]);

  useEffect(() => {
    if (!hydrated) return;
    savePrefs(slug, prefs);
    replaceMapViewUrl(prefs, { defaultFloorId: initialFloorId, floors: floorsRef.current });
  }, [hydrated, slug, prefs, initialFloorId]);

  const patchPrefs = useCallback((patch: Partial<MapViewPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  const setViewMode = useCallback((viewMode: ViewMode) => patchPrefs({ viewMode }), [patchPrefs]);
  const setHallView = useCallback(
    (hallView: HallView | ((prev: HallView) => HallView)) => {
      setPrefs((prev) => ({
        ...prev,
        hallView: typeof hallView === "function" ? hallView(prev.hallView) : hallView,
      }));
    },
    [],
  );
  const patchHallView = useCallback((patch: Partial<HallView>) => {
    setPrefs((prev) => ({ ...prev, hallView: { ...prev.hallView, ...patch } }));
  }, []);
  const setHallSettingsOpen = useCallback(
    (hallSettingsOpen: boolean | ((prev: boolean) => boolean)) => {
      setPrefs((prev) => ({
        ...prev,
        hallSettingsOpen:
          typeof hallSettingsOpen === "function" ? hallSettingsOpen(prev.hallSettingsOpen) : hallSettingsOpen,
      }));
    },
    [],
  );
  const setShowGrid = useCallback((showGrid: boolean) => patchPrefs({ showGrid }), [patchPrefs]);
  const setShowRulers = useCallback((showRulers: boolean) => patchPrefs({ showRulers }), [patchPrefs]);
  const setShowUnderlay = useCallback((showUnderlay: boolean) => patchPrefs({ showUnderlay }), [patchPrefs]);
  const setShowObjectSizes = useCallback(
    (showObjectSizes: boolean) => patchPrefs({ showObjectSizes }),
    [patchPrefs],
  );
  const setFloorId = useCallback((floorId: string) => patchPrefs({ floorId }), [patchPrefs]);

  return {
    ...prefs,
    setViewMode,
    setHallView,
    patchHallView,
    setHallSettingsOpen,
    setShowGrid,
    setShowRulers,
    setShowUnderlay,
    setShowObjectSizes,
    setFloorId,
  };
}
