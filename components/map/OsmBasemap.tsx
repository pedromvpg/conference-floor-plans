"use client";

import { useLayoutEffect, useEffect, useRef, type RefObject } from "react";
import { Map as MaplibreMap, type StyleSpecification } from "maplibre-gl";
import { useTheme } from "@/components/theme-provider";
import { floorDeltaToEnu, offsetLatLng, zoomDeltaToMatchSpan } from "@/lib/basemap";
import type { FloorBasemap } from "@/lib/types";

export type LeafletCam = {
  lat: number;
  lng: number;
  zoom: number;
  bearing: number;
  east: number;
  north: number;
};

const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY?.trim() ?? "";
const LOCK_SPAN_M = 10;

function withCartoKey(url: string) {
  if (!CARTO_KEY) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}key=${encodeURIComponent(CARTO_KEY)}`;
}

/** CARTO Positron / Dark Matter rasters. Free key: https://carto.com/basemaps/apikey */
function cartoRasterStyle(dark: boolean): StyleSpecification {
  const path = dark ? "dark_all" : "light_all";
  const tiles = ["a", "b", "c", "d"].map((s) =>
    withCartoKey(`https://${s}.basemaps.cartocdn.com/${path}/{z}/{x}/{y}@2x.png`),
  );
  return {
    version: 8,
    name: dark ? "CARTO Dark Matter" : "CARTO Positron",
    sources: {
      carto: {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, © <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [{ id: "carto", type: "raster", source: "carto" }],
  };
}

type HallLock = { x: number; y: number; lat: number; lng: number };

type Props = {
  view: FloorBasemap;
  camera: LeafletCam;
  svgRef: RefObject<SVGSVGElement | null>;
  hall: HallLock;
  syncKey?: number;
};

function svgToMapPx(svg: SVGSVGElement, mapEl: HTMLElement, x: number, y: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const screen = pt.matrixTransform(ctm);
  const rect = mapEl.getBoundingClientRect();
  return { x: screen.x - rect.left, y: screen.y - rect.top };
}

function lockMapToSvg(map: MaplibreMap, camera: LeafletCam, svg: SVGSVGElement | null, hall: HallLock) {
  if (!map.isStyleLoaded()) return false;
  const zoom = Number.isFinite(camera.zoom) ? Math.min(24, Math.max(0, camera.zoom)) : 16;
  const lat = Number.isFinite(camera.lat) ? camera.lat : 0;
  const lng = Number.isFinite(camera.lng) ? camera.lng : 0;
  const bearing = Number.isFinite(camera.bearing) ? camera.bearing : 0;
  map.stop();
  map.jumpTo({ center: [lng, lat], zoom, bearing, pitch: 0 });
  if (!svg) return true;
  const container = map.getContainer();
  const want = svgToMapPx(svg, container, hall.x, hall.y);
  const want2 = svgToMapPx(svg, container, hall.x + LOCK_SPAN_M, hall.y);
  if (!want || !want2) return true;
  const { east, north } = floorDeltaToEnu(LOCK_SPAN_M, 0, bearing);
  const p2 = offsetLatLng(hall.lat, hall.lng, east, north);
  const got = map.project({ lng: hall.lng, lat: hall.lat });
  const got2 = map.project({ lng: p2.lng, lat: p2.lat });
  const dz = zoomDeltaToMatchSpan(
    Math.hypot(got2.x - got.x, got2.y - got.y),
    Math.hypot(want2.x - want.x, want2.y - want.y),
  );
  if (Math.abs(dz) > 1e-4) {
    map.jumpTo({
      center: [lng, lat],
      zoom: Math.min(24, Math.max(0, map.getZoom() - dz)),
      bearing,
      pitch: 0,
    });
  }
  const pinned = map.project({ lng: hall.lng, lat: hall.lat });
  const dx = pinned.x - want.x;
  const dy = pinned.y - want.y;
  if (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02) {
    map.panBy([dx, dy], { duration: 0, animate: false });
  }
  return true;
}

export function OsmBasemap({ view, camera, svgRef, hall, syncKey = 0 }: Props) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const rafRef = useRef(0);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const hallRef = useRef(hall);
  hallRef.current = hall;
  const svgBoxRef = useRef(svgRef);
  svgBoxRef.current = svgRef;

  function runLock() {
    const map = mapRef.current;
    if (!map) return;
    lockMapToSvg(map, cameraRef.current, svgBoxRef.current.current, hallRef.current);
  }

  function scheduleLock() {
    const map = mapRef.current;
    if (!map) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      runLock();
      rafRef.current = requestAnimationFrame(runLock);
    });
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.inset = "0";
    el.style.width = "100%";
    el.style.height = "100%";
    host.appendChild(el);
    const map = new MaplibreMap({
      container: el,
      style: cartoRasterStyle(dark),
      center: [camera.lng, camera.lat],
      zoom: Number.isFinite(camera.zoom) ? camera.zoom : 16,
      bearing: Number.isFinite(camera.bearing) ? camera.bearing : 0,
      minZoom: 0,
      maxZoom: 24,
      attributionControl: false,
      maplibreLogo: false,
      cooperativeGestures: false,
      fadeDuration: 0,
      maxPitch: 0,
      scrollZoom: false,
      boxZoom: false,
      doubleClickZoom: false,
      dragRotate: false,
      dragPan: false,
      keyboard: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disable();
    const onReady = () => {
      map.resize();
      scheduleLock();
    };
    map.on("load", onReady);
    map.on("style.load", onReady);
    mapRef.current = map;
    const ro = new ResizeObserver(() => {
      map.resize();
      scheduleLock();
    });
    ro.observe(host);
    const onWin = () => {
      map.resize();
      scheduleLock();
    };
    window.addEventListener("resize", onWin);
    window.visualViewport?.addEventListener("resize", onWin);
    const raf = requestAnimationFrame(() => {
      map.resize();
      scheduleLock();
    });
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onWin);
      window.visualViewport?.removeEventListener("resize", onWin);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      el.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styleOnce = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!styleOnce.current) {
      styleOnce.current = true;
      return;
    }
    map.setStyle(cartoRasterStyle(dark));
  }, [dark]);

  useLayoutEffect(() => {
    scheduleLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    camera.lat,
    camera.lng,
    camera.zoom,
    camera.bearing,
    camera.east,
    camera.north,
    hall.x,
    hall.y,
    hall.lat,
    hall.lng,
    syncKey,
    svgRef,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvasContainer().style.opacity = String(view.opacity);
  }, [view.opacity]);

  return (
    <>
      <div
        ref={hostRef}
        className="pointer-events-none absolute inset-0 z-0 h-full w-full [&_.maplibregl-ctrl-logo]:hidden"
      />
      <p className="pointer-events-none absolute right-2 bottom-1.5 z-20 rounded-sm bg-background/70 px-1.5 py-0.5 text-right text-[11px] leading-snug text-muted-foreground [text-shadow:0_0_8px_var(--map-bg)] backdrop-blur-[2px]">
        <span>© </span>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto hover:text-foreground hover:underline"
        >
          OpenStreetMap
        </a>
        <span>, © </span>
        <a
          href="https://carto.com/attributions"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto hover:text-foreground hover:underline"
        >
          CARTO
        </a>
      </p>
    </>
  );
}
