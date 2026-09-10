"use client";

import { useLayoutEffect, useEffect, useRef, type RefObject } from "react";
import { Map as MaplibreMap, type StyleSpecification } from "maplibre-gl";
import { useTheme } from "@/components/theme-provider";
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
};

function pinHallToSvg(map: MaplibreMap, svg: SVGSVGElement, hall: HallLock) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return;
  const pt = svg.createSVGPoint();
  pt.x = hall.x;
  pt.y = hall.y;
  const hallScreen = pt.matrixTransform(ctm);
  const rect = map.getContainer().getBoundingClientRect();
  const wantX = hallScreen.x - rect.left;
  const wantY = hallScreen.y - rect.top;
  const got = map.project({ lng: hall.lng, lat: hall.lat });
  const dx = got.x - wantX;
  const dy = got.y - wantY;
  if (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02) {
    map.panBy([dx, dy], { duration: 0, animate: false });
  }
}

function applyCamera(map: MaplibreMap, camera: LeafletCam, svg: SVGSVGElement | null, hall: HallLock) {
  if (!map.isStyleLoaded()) return;
  const zoom = Number.isFinite(camera.zoom) ? Math.min(24, Math.max(0, camera.zoom)) : 16;
  const lat = Number.isFinite(camera.lat) ? camera.lat : 0;
  const lng = Number.isFinite(camera.lng) ? camera.lng : 0;
  const bearing = Number.isFinite(camera.bearing) ? camera.bearing : 0;
  map.jumpTo({ center: [lng, lat], zoom, bearing, pitch: 0 });
  if (svg) pinHallToSvg(map, svg, hall);
}

export function OsmBasemap({ view, camera, svgRef, hall }: Props) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const readyRef = useRef(false);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const hallRef = useRef(hall);
  hallRef.current = hall;
  const svgBoxRef = useRef(svgRef);
  svgBoxRef.current = svgRef;

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
      readyRef.current = true;
      map.resize();
      applyCamera(map, cameraRef.current, svgBoxRef.current.current, hallRef.current);
    };
    map.on("load", onReady);
    mapRef.current = map;
    const ro = new ResizeObserver(() => {
      map.resize();
      if (readyRef.current) applyCamera(map, cameraRef.current, svgBoxRef.current.current, hallRef.current);
    });
    ro.observe(host);
    const raf = requestAnimationFrame(() => {
      map.resize();
      if (readyRef.current) applyCamera(map, cameraRef.current, svgBoxRef.current.current, hallRef.current);
    });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      readyRef.current = false;
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
    readyRef.current = false;
    map.setStyle(cartoRasterStyle(dark));
    map.once("load", () => {
      readyRef.current = true;
      map.resize();
      applyCamera(map, cameraRef.current, svgBoxRef.current.current, hallRef.current);
    });
  }, [dark]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyCamera(map, camera, svgRef.current, hall);
  }, [camera.lat, camera.lng, camera.zoom, camera.bearing, camera.east, camera.north, hall.x, hall.y, hall.lat, hall.lng, svgRef]);

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
      <p className="pointer-events-none absolute right-2 bottom-1.5 z-20 text-right text-[10px] leading-none text-muted-foreground/40 [text-shadow:0_0_6px_var(--map-bg)]">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto hover:text-muted-foreground hover:underline"
        >
          OpenStreetMap
        </a>
        <span>, © </span>
        <a
          href="https://carto.com/attributions"
          target="_blank"
          rel="noreferrer"
          className="pointer-events-auto hover:text-muted-foreground hover:underline"
        >
          CARTO
        </a>
      </p>
    </>
  );
}
