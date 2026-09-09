"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Box, ChevronDown, Eye, EyeOff, LayoutGrid, MapPin, Maximize2, Pentagon, Plus, Redo2, Settings, Square, Theater, Undo2 } from "lucide-react";
import { ObjectMediaFields } from "@/components/designer/ObjectMediaFields";
import { SponsorCombobox } from "@/components/designer/SponsorCombobox";
import { UnderlayPreview } from "@/components/designer/UnderlayPreview";
import { VenueLayersEditor } from "@/components/designer/VenueLayersEditor";
import { FloorCanvas } from "@/components/map/FloorCanvas";
import { FloorSwitcher, GridToggle, ViewModeToggle } from "@/components/map/ViewModeToggle";
import { UnitsToggle } from "@/components/units-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AMENITIES, amenityLabel } from "@/lib/amenities";
import { STAGE_PRESET_METERS, resolveAppearance } from "@/lib/appearance";
import { DEFAULT_FLOOR_BASEMAP, BASEMAP_COORD_STEP, bearingSliderValue, roundBasemapCoord, wrapBearingDeg } from "@/lib/basemap";
import { calibrationFromBounds, floorSizeMeters, ringBounds, scaleRingToSize } from "@/lib/geometry";
import { commitShape, objectShape, rotateBezier, translateBezier } from "@/lib/bezier";
import { PRESETS, presetMeters as presetSize, formatArea, formatSize, fromMeters, toMeters } from "@/lib/units";
import { useUnits } from "@/lib/use-units";
import type {
  AmenityType,
  Appearance,
  Calibration,
  DraftBundle,
  DraftSlice,
  DraftVersionMeta,
  Floor,
  FloorBasemap,
  MapObject,
  Sponsor,
  Tool,
  Units,
  ViewMode,
} from "@/lib/types";
import { VENUE_ID } from "@/lib/types";
import {
  blankVenueSvg,
  deleteSvgLayer,
  findSvgLayer,
  groupSvgLayers,
  isSvgUnderlay,
  listSvgLayers,
  reorderSvgSiblings,
  reparentSvgLayer,
  serializeSvg,
  setSvgElementPaint,
  setSvgElementRotation,
  setSvgLayerHidden,
  setSvgLayerLocked,
  setSvgLayerName,
  setSvgLayerText,
  svgElementMetrics,
  svgElementPaint,
  svgElementRotation,
  svgViewBox,
  ungroupSvgLayer,
  wrapRasterAsSvg,
} from "@/lib/svg-layers";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { newId, nowIso } from "@/lib/store";
import { toast } from "sonner";

const HallCanvas = dynamic(() => import("@/components/hall/HallCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#12110f] font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
      Loading hall…
    </div>
  ),
});

type ObjectFilter = "all" | "booths" | "stages" | "icons";
type ObjectSort = "name" | "size" | "modified";
type SortDir = "asc" | "desc";

const OBJECT_FILTERS: {
  value: ObjectFilter;
  label: string;
  icon: typeof Square;
}[] = [
  { value: "all", label: "All", icon: LayoutGrid },
  { value: "booths", label: "Booths", icon: Square },
  { value: "stages", label: "Stages", icon: Theater },
  { value: "icons", label: "Icons", icon: MapPin },
];

function isStage(o: MapObject): boolean {
  return /\bstage\b/i.test(`${o.name} ${o.boothNumber}`);
}

function isBooth(o: MapObject): boolean {
  return o.kind === "booth" && !isStage(o);
}

function objectTitle(o: MapObject, sponsor?: Sponsor): string {
  return sponsor?.name || o.name || o.boothNumber || amenityLabel(o.amenityType ?? "info");
}

function objectArea(o: MapObject): number {
  if (!o.polygon?.length) return 0;
  const b = ringBounds(o.polygon);
  return b.w * b.h;
}

const CLIP_PREFIX = "conference-maps-objects:v1:";
const PASTE_NUDGE_M = 1;

function isTypingTarget(el: EventTarget | null) {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

function paintToHex(value: string, fallback: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return fallback;
}

function parseCopiedObjects(text: string): MapObject[] | null {
  if (!text.startsWith(CLIP_PREFIX)) return null;
  try {
    const data = JSON.parse(text.slice(CLIP_PREFIX.length)) as unknown;
    if (!Array.isArray(data) || data.length === 0) return null;
    return data as MapObject[];
  } catch {
    return null;
  }
}

function cloneObjectAt(src: MapObject, floorId: string, dx: number, dy: number): MapObject {
  const t = nowIso();
  const path = src.path?.length
    ? translateBezier(src.path, dx, dy)
    : src.polygon
      ? translateBezier(objectShape(src), dx, dy)
      : null;
  const polygon = path ? commitShape(path).polygon : src.polygon;
  return {
    ...src,
    id: newId(),
    floorId,
    polygon,
    path,
    x: src.x != null ? src.x + dx : null,
    y: src.y != null ? src.y + dy : null,
    createdAt: t,
    updatedAt: t,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatSavedWhen(at: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - at.getTime());
  if (ms >= DAY_MS) {
    return at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const sec = Math.floor(ms / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function fmtDim(meters: number, units: Units): string {
  const v = fromMeters(meters, units);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
}

function parseDim(raw: string): number {
  return Number(raw.trim().replace(",", "."));
}

async function rasterizeIfPdf(file: File): Promise<File> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return file;
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("rasterize failed"))), "image/png");
  });
  return new File([blob], file.name.replace(/\.pdf$/i, ".png"), { type: "image/png" });
}

export function DesignerApp({ initial }: { initial: DraftBundle }) {
  const [bundle, setBundle] = useState(initial);
  const [floorId, setFloorId] = useState(initial.floors[0]?.id ?? "");
  const [tool, setTool] = useState<Tool>("select");
  const [viewMode, setViewMode] = useState<ViewMode>("plan");
  const [stampAppearance, setStampAppearance] = useState<Appearance | null>(null);
  const [stampModelId, setStampModelId] = useState<string | null>(null);
  const [units, setUnits] = useUnits();
  const [presetId, setPresetId] = useState<string>("none");
  const [amenityStamp, setAmenityStamp] = useState<AmenityType>("bathroom");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[0] ?? null;
  const [frameNonce, setFrameNonce] = useState(0);
  const [fitNonce, setFitNonce] = useState(0);
  const [sponsorQuery, setSponsorQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"objects" | "venue" | "map">("objects");
  const [derivedMapZoom, setDerivedMapZoom] = useState<number | null>(null);
  const [mapZoomTo, setMapZoomTo] = useState<{ zoom: number; nonce: number } | null>(null);
  const [alignDrawingToMap, setAlignDrawingToMap] = useState(false);
  const onBasemapDerivedZoom = useCallback((z: number) => {
    if (!Number.isFinite(z)) return;
    const next = Math.round(z * 100) / 100;
    setDerivedMapZoom((prev) => (prev === next ? prev : next));
  }, []);
  const [objectFilter, setObjectFilter] = useState<ObjectFilter>("all");
  const [objectSort, setObjectSort] = useState<ObjectSort>("name");
  const [objectSortDir, setObjectSortDir] = useState<SortDir>("asc");
  const [constrainProportions, setConstrainProportions] = useState(true);
  const [boothWidth, setBoothWidth] = useState("");
  const [boothHeight, setBoothHeight] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [saveLabel, setSaveLabel] = useState<"Saved" | "Saving…">("Saved");
  const [versions, setVersions] = useState<DraftVersionMeta[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [scaleLength, setScaleLength] = useState("10");
  const [venueWidth, setVenueWidth] = useState("");
  const [venueHeight, setVenueHeight] = useState("");
  const [underlayOpacity, setUnderlayOpacity] = useState(1);
  const [showUnderlay, setShowUnderlay] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [editVenueLayers, setEditVenueLayers] = useState(false);
  const [venueSvg, setVenueSvg] = useState<string | null>(null);
  const [hoverLayerId, setHoverLayerId] = useState<string | null>(null);
  const [selectedVenueEl, setSelectedVenueEl] = useState<string | null>(null);
  const [selectedVenueEls, setSelectedVenueEls] = useState<string[]>([]);

  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;
  const pastRef = useRef<DraftSlice[]>([]);
  const futureRef = useRef<DraftSlice[]>([]);
  const coalesceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSvgFetchUrl = useRef<string | null>(null);
  const venueSvgSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectClipboardRef = useRef<MapObject[] | null>(null);
  const pasteGenRef = useRef(1);
  const venueEditRef = useRef({
    el: null as string | null,
    els: [] as string[],
    svg: null as string | null,
    tab: "objects" as string,
  });

  const floorsSorted = useMemo(
    () => [...bundle.floors].sort((a, b) => a.sortOrder - b.sortOrder),
    [bundle.floors],
  );
  const floor = floorsSorted.find((f) => f.id === floorId) ?? floorsSorted[0];
  const objects = bundle.objects.filter((o) => o.floorId === floor?.id);
  const venueSelected = selectedIds.length === 1 && selectedIds[0] === VENUE_ID;
  const multiSelected = selectedIds.filter((id) => id !== VENUE_ID).length > 1;
  const selected =
    !venueSelected && selectedIds.length === 1
      ? (objects.find((o) => o.id === selectedIds[0]) ?? null)
      : null;
  const preset =
    presetId === "stage" ? STAGE_PRESET_METERS : presetId ? presetSize(presetId) : null;
  const listedObjects = useMemo(() => {
    const matches = objects.filter((o) => {
      if (objectFilter === "booths") return isBooth(o);
      if (objectFilter === "stages") return isStage(o);
      if (objectFilter === "icons") return o.kind === "amenity";
      return true;
    });
    return [...matches].sort((a, b) => {
      const sa = a.sponsorId ? bundle.sponsors.find((sp) => sp.id === a.sponsorId) : undefined;
      const sb = b.sponsorId ? bundle.sponsors.find((sp) => sp.id === b.sponsorId) : undefined;
      const byName = objectTitle(a, sa).localeCompare(objectTitle(b, sb));
      let cmp = 0;
      if (objectSort === "size") cmp = objectArea(a) - objectArea(b);
      else if (objectSort === "modified") cmp = Date.parse(a.updatedAt || "0") - Date.parse(b.updatedAt || "0");
      else cmp = byName;
      if (cmp === 0) cmp = byName;
      return objectSortDir === "asc" ? cmp : -cmp;
    });
  }, [objects, objectFilter, objectSort, objectSortDir, bundle.sponsors]);

  const selectedVenueLayer = useMemo(() => {
    if (!venueSvg || !selectedVenueEl) return null;
    try {
      return findSvgLayer(listSvgLayers(venueSvg), selectedVenueEl);
    } catch {
      return null;
    }
  }, [venueSvg, selectedVenueEl]);

  const selectedVenuePaint = useMemo(() => {
    if (!venueSvg || !selectedVenueEl) return null;
    try {
      return svgElementPaint(venueSvg, selectedVenueEl);
    } catch {
      return null;
    }
  }, [venueSvg, selectedVenueEl]);

  const selectedVenueMetrics = useMemo(() => {
    if (!venueSvg || !selectedVenueEl || !floor?.calibration) return null;
    try {
      const raw = svgElementMetrics(venueSvg, selectedVenueEl);
      const vb = svgViewBox(venueSvg);
      if (!raw || !vb || vb.w <= 0 || vb.h <= 0) return null;
      const size = floorSizeMeters(floor.calibration);
      const sx = size.w / vb.w;
      const sy = size.h / vb.h;
      return { w: raw.w * sx, h: raw.h * sy, area: raw.area * sx * sy };
    } catch {
      return null;
    }
  }, [venueSvg, selectedVenueEl, floor?.calibration]);

  venueEditRef.current = { el: selectedVenueEl, els: selectedVenueEls, svg: venueSvg, tab: sidebarTab };

  const slug = bundle.event.slug;

  useEffect(() => {
    if (viewMode !== "hall") return;
    void fetch(`/api/events/${slug}`).then(async (res) => {
      if (!res.ok) return;
      const data = (await res.json()) as DraftBundle;
      setBundle((b) => ({
        ...b,
        assets: data.assets ?? b.assets,
        sponsors: data.sponsors ?? b.sponsors,
      }));
    });
  }, [viewMode, slug]);

  const cal = floor?.calibration;
  const calKey = cal
    ? `${cal.metersPerPixel}:${cal.metersPerPixelY ?? ""}:${cal.widthPx}:${cal.heightPx}`
    : "";

  useEffect(() => {
    if (!floor?.calibration) {
      setVenueWidth("");
      setVenueHeight("");
      return;
    }
    const ae = typeof document !== "undefined" ? document.activeElement : null;
    const id = ae instanceof HTMLElement ? ae.id : "";
    if (id.startsWith("venue-") || id.startsWith("insp-venue-")) return;
    const size = floorSizeMeters(floor.calibration);
    setVenueWidth(fmtDim(size.w, units));
    setVenueHeight(fmtDim(size.h, units));
  }, [floor?.id, calKey, units]);

  useEffect(() => {
    const url = floor?.underlayUrl;
    if (!url) {
      setVenueSvg(null);
      setEditVenueLayers(false);
      return;
    }
    if (skipSvgFetchUrl.current === url) return;
    let cancelled = false;
    void fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("Could not load drawing"))))
      .then((text) => {
        if (cancelled || !text.includes("<svg")) return;
        try {
          setVenueSvg(serializeSvg(text));
        } catch {
          setVenueSvg(text);
        }
      })
      .catch(() => {
        if (!cancelled) setVenueSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [floor?.id, floor?.underlayUrl]);

  useEffect(() => {
    if (!selected?.polygon) {
      setBoothWidth("");
      setBoothHeight("");
      return;
    }
    const b = ringBounds(selected.polygon);
    const nextW = fmtDim(b.w, units);
    const nextH = fmtDim(b.h, units);
    setBoothWidth((w) => (w === nextW ? w : nextW));
    setBoothHeight((h) => (h === nextH ? h : nextH));
  }, [
    selected?.id,
    selected?.polygon ? Math.round(ringBounds(selected.polygon).w * 1000) : 0,
    selected?.polygon ? Math.round(ringBounds(selected.polygon).h * 1000) : 0,
    units,
  ]);

  function cloneSlice(b = bundleRef.current): DraftSlice {
    return {
      floors: structuredClone(b.floors),
      objects: structuredClone(b.objects),
    };
  }

  function syncUndoFlags() {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }

  function markHistory() {
    if (!coalesceRef.current) {
      pastRef.current = [...pastRef.current, cloneSlice()].slice(-80);
      futureRef.current = [];
      syncUndoFlags();
    } else {
      clearTimeout(coalesceRef.current);
    }
    coalesceRef.current = setTimeout(() => {
      coalesceRef.current = null;
    }, 500);
  }

  useEffect(() => {
    setLastSavedAt(new Date());
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshVersions = useCallback(async () => {
    const res = await fetch(`/api/events/${slug}/versions`);
    if (!res.ok) return;
    const data = (await res.json()) as { versions: DraftVersionMeta[] };
    setVersions(data.versions);
  }, [slug]);

  const snapshotVersion = useCallback((immediate = false) => {
    if (versionTimer.current) clearTimeout(versionTimer.current);
    const run = async () => {
      const res = await fetch(`/api/events/${slug}/versions`, { method: "POST" });
      if (!res.ok) return;
      const data = (await res.json()) as { version: DraftVersionMeta | null };
      if (data.version) {
        setVersions((v) => [data.version!, ...v.filter((x) => x.id !== data.version!.id)].slice(0, 30));
      } else {
        await refreshVersions();
      }
    };
    if (immediate) {
      void run();
      return;
    }
    versionTimer.current = setTimeout(() => {
      void run();
    }, 1200);
  }, [slug, refreshVersions]);

  function markSaved() {
    setLastSavedAt(new Date());
    setSaveLabel("Saved");
    snapshotVersion();
  }

  async function persistSlice(slice: DraftSlice) {
    setSaveLabel("Saving…");
    const res = await fetch(`/api/events/${slug}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slice),
    });
    if (!res.ok) {
      setSaveLabel("Saved");
      throw new Error("Could not save");
    }
    const saved = (await res.json()) as DraftSlice;
    setBundle((b) => ({ ...b, floors: saved.floors, objects: saved.objects }));
    markSaved();
    return saved;
  }

  const basemapSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function patchBasemap(next: FloorBasemap, immediate = false) {
    if (!floor) return;
    const nextFloors = bundleRef.current.floors.map((f) => (f.id === floor.id ? { ...f, basemap: next } : f));
    const objects = bundleRef.current.objects;
    bundleRef.current = { ...bundleRef.current, floors: nextFloors };
    setBundle((b) => ({ ...b, floors: nextFloors }));
    if (basemapSaveTimer.current) clearTimeout(basemapSaveTimer.current);
    const save = () => {
      basemapSaveTimer.current = null;
      void persistSlice({ floors: bundleRef.current.floors, objects: bundleRef.current.objects }).catch(() =>
        toast.error("Could not save map"),
      );
    };
    if (immediate) {
      void persistSlice({ floors: nextFloors, objects }).catch(() => toast.error("Could not save map"));
    } else {
      basemapSaveTimer.current = setTimeout(save, 280);
    }
  }

  async function undo() {
    if (coalesceRef.current) {
      clearTimeout(coalesceRef.current);
      coalesceRef.current = null;
    }
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current = [...futureRef.current, cloneSlice()].slice(-80);
    syncUndoFlags();
    setSelectedIds([]);
    try {
      await persistSlice(prev);
    } catch {
      toast.error("Could not undo");
    }
  }

  async function redo() {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current = [...pastRef.current, cloneSlice()].slice(-80);
    syncUndoFlags();
    setSelectedIds([]);
    try {
      await persistSlice(next);
    } catch {
      toast.error("Could not redo");
    }
  }

  async function restoreVersion(id: string) {
    markHistory();
    setSaveLabel("Saving…");
    const res = await fetch(`/api/events/${slug}/versions/${id}`, { method: "POST" });
    if (!res.ok) {
      toast.error("Could not restore version");
      setSaveLabel("Saved");
      return;
    }
    const saved = (await res.json()) as DraftSlice;
    setBundle((b) => ({ ...b, floors: saved.floors, objects: saved.objects }));
    if (saved.floors[0] && !saved.floors.some((f) => f.id === floorId)) {
      setFloorId(saved.floors[0].id);
    }
    setSelectedIds([]);
    markSaved();
    toast.success("Restored last saved version");
  }

  useEffect(() => {
    void refreshVersions();
    snapshotVersion(true);
  }, [refreshVersions, snapshotVersion]);

  const filteredSponsors = useMemo(() => {
    const q = sponsorQuery.trim().toLowerCase();
    if (!q) return bundle.sponsors.slice(0, 40);
    return bundle.sponsors.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.boothNumber.toLowerCase().includes(q) ||
        s.tier.toLowerCase().includes(q),
    );
  }, [bundle.sponsors, sponsorQuery]);

  const patchObject = useCallback(async (obj: MapObject) => {
    markHistory();
    setSaveLabel("Saving…");
    setBundle((b) => ({
      ...b,
      objects: b.objects.map((o) => (o.id === obj.id ? obj : o)),
    }));
    await fetch("/api/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });
    markSaved();
  }, [snapshotVersion]);

  const patchObjects = useCallback(async (objs: MapObject[]) => {
    if (!objs.length) return;
    markHistory();
    setSaveLabel("Saving…");
    const byId = new Map(objs.map((o) => [o.id, o]));
    setBundle((b) => ({
      ...b,
      objects: b.objects.map((o) => byId.get(o.id) ?? o),
    }));
    await Promise.all(
      objs.map((obj) =>
        fetch("/api/objects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(obj),
        }),
      ),
    );
    markSaved();
  }, [snapshotVersion]);

  function applyBoothSize(axis: "w" | "h", raw: string) {
    if (!selected?.polygon) return;
    const entered = toMeters(parseDim(raw), units);
    if (!Number.isFinite(entered) || entered <= 0) return;
    const b = ringBounds(selected.polygon);
    let w = axis === "w" ? entered : b.w;
    let h = axis === "h" ? entered : b.h;
    if (constrainProportions && b.w > 0 && b.h > 0) {
      const ratio = b.w / b.h;
      if (axis === "w") h = w / ratio;
      else w = h * ratio;
    }
    const polygon = scaleRingToSize(selected.polygon, w, h);
    const nb = ringBounds(polygon);
    setBoothWidth(fmtDim(nb.w, units));
    setBoothHeight(fmtDim(nb.h, units));
    void patchObject({ ...selected, polygon });
  }

  function matchingBoothPresetId(w: number, h: number): string {
    const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
    for (const p of PRESETS) {
      const m = presetSize(p.id);
      if (!m) continue;
      if ((near(w, m.w) && near(h, m.d)) || (near(w, m.d) && near(h, m.w))) return p.id;
    }
    if (
      (near(w, STAGE_PRESET_METERS.w) && near(h, STAGE_PRESET_METERS.d)) ||
      (near(w, STAGE_PRESET_METERS.d) && near(h, STAGE_PRESET_METERS.w))
    ) {
      return "stage";
    }
    return "custom";
  }

  function applyObjectRotation(nextDeg: number) {
    if (!selected) return;
    if (!Number.isFinite(nextDeg)) return;
    if (selected.kind === "amenity") {
      void patchObject({ ...selected, rotation: nextDeg, facingDeg: nextDeg });
      return;
    }
    if (!selected.polygon) return;
    const delta = nextDeg - (selected.facingDeg ?? 0);
    const rotated = commitShape(rotateBezier(objectShape(selected), delta));
    void patchObject({
      ...selected,
      polygon: rotated.polygon,
      path: rotated.path,
      facingDeg: nextDeg,
      rotation: nextDeg,
    });
  }

  function applyBoothPreset(id: string) {
    if (!selected?.polygon || id === "custom") return;
    const size = id === "stage" ? STAGE_PRESET_METERS : presetSize(id);
    if (!size) return;
    const polygon = scaleRingToSize(selected.polygon, size.w, size.d);
    const nb = ringBounds(polygon);
    setBoothWidth(fmtDim(nb.w, units));
    setBoothHeight(fmtDim(nb.h, units));
    void patchObject({ ...selected, polygon });
  }

  function onVenueWidthChange(v: string) {
    setVenueWidth(v);
  }

  function onVenueHeightChange(v: string) {
    setVenueHeight(v);
  }

  const createObjects = useCallback(async (objs: MapObject[]) => {
    if (!objs.length) return;
    markHistory();
    setSaveLabel("Saving…");
    setBundle((b) => ({ ...b, objects: [...b.objects, ...objs] }));
    setSelectedIds(objs.map((o) => o.id));
    setSidebarTab("objects");
    await Promise.all(
      objs.map((obj) =>
        fetch("/api/objects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(obj),
        }),
      ),
    );
    markSaved();
  }, [snapshotVersion]);

  const createObject = useCallback(
    async (obj: MapObject) => {
      await createObjects([obj]);
    },
    [createObjects],
  );

  async function onCalibrated(next: Calibration, _previous: Calibration | null) {
    if (!floor) return;
    markHistory();
    const nextFloors = bundle.floors.map((f) => (f.id === floor.id ? { ...f, calibration: next } : f));
    try {
      await persistSlice({ floors: nextFloors, objects: bundle.objects });
      setTool("select");
      setFitNonce((n) => n + 1);
    } catch {
      toast.error("Could not save scale");
    }
  }

  async function applyVenueBounds() {
    if (!floor) return;
    const widthM = toMeters(parseDim(venueWidth), units);
    const heightM = toMeters(parseDim(venueHeight), units);
    if (!Number.isFinite(widthM) || !Number.isFinite(heightM) || widthM <= 0 || heightM <= 0) {
      toast.error("Enter a positive width and height");
      return;
    }
    const widthPx = floor.calibration?.widthPx;
    const heightPx = floor.calibration?.heightPx;
    if (!widthPx || !heightPx) {
      toast.error("Import a venue drawing first");
      return;
    }
    await onCalibrated(
      calibrationFromBounds(
        widthM,
        heightM,
        widthPx,
        heightPx,
        floor.calibration?.originX ?? 0,
        floor.calibration?.originY ?? 0,
      ),
      floor.calibration,
    );
  }

  async function uploadUnderlay(file: File, targetFloorId?: string) {
    const id = targetFloorId ?? floor?.id;
    if (!id) return;
    markHistory();
    setBusy(true);
    setSaveLabel("Saving…");
    try {
      const ready = await rasterizeIfPdf(file);
      const fd = new FormData();
      fd.set("file", ready);
      const res = await fetch(`/api/floors/${id}/underlay`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as Floor;
      setBundle((b) => ({
        ...b,
        floors: b.floors.map((f) => (f.id === updated.id ? updated : f)),
      }));
      setFloorId(updated.id);
      setSidebarTab("venue");
      setTool("calibrate");
      toast.success("Drawing imported. Enter a known length, then click its two ends.");
      markSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function persistVenueSvg(svg: string, targetFloorId: string) {
    const res = await fetch(`/api/floors/${targetFloorId}/underlay`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svg }),
    });
    if (!res.ok) throw new Error(await res.text());
    const updated = (await res.json()) as Floor;
    skipSvgFetchUrl.current = updated.underlayUrl;
    setBundle((b) => ({
      ...b,
      floors: b.floors.map((f) => (f.id === updated.id ? updated : f)),
    }));
    markSaved();
  }

  function selectVenueLayer(id: string | null, additive = false) {
    if (!id) {
      setSelectedVenueEl(null);
      setSelectedVenueEls([]);
      return;
    }
    if (additive) {
      setSelectedVenueEls((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((x) => x !== id) : [...prev, id];
        setSelectedVenueEl(next[next.length - 1] ?? null);
        return next;
      });
      return;
    }
    setSelectedVenueEl(id);
    setSelectedVenueEls([id]);
  }

  function groupSelectedVenueLayers() {
    if (!venueSvg || selectedVenueEls.length < 1) return;
    const { markup, groupId } = groupSvgLayers(venueSvg, selectedVenueEls);
    if (!groupId) {
      toast.error("Layers must share the same parent to group.");
      return;
    }
    commitVenueSvg(markup);
    selectVenueLayer(groupId);
  }

  function ungroupVenueLayer(id: string) {
    if (!venueSvg) return;
    const next = ungroupSvgLayer(venueSvg, id);
    if (next === venueSvg) return;
    commitVenueSvg(next);
    if (selectedVenueEl === id) {
      setSelectedVenueEl(null);
      setSelectedVenueEls([]);
    }
  }

  function commitVenueSvg(next: string) {
    const id = floor?.id;
    if (!id) return;
    markHistory();
    setVenueSvg(next);
    setSaveLabel("Saving…");
    if (venueSvgSaveTimer.current) clearTimeout(venueSvgSaveTimer.current);
    venueSvgSaveTimer.current = setTimeout(() => {
      void persistVenueSvg(next, id).catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not save layers");
        setSaveLabel("Saved");
      });
    }, 450);
  }

  function deleteSelectedVenueElement() {
    if (!venueSvg || !selectedVenueEls.length) return;
    let next = venueSvg;
    for (const id of selectedVenueEls) next = deleteSvgLayer(next, id);
    commitVenueSvg(next);
    setSelectedVenueEl(null);
    setSelectedVenueEls([]);
  }

  function ensureVenueDrawing(): string | null {
    if (venueSvg) return venueSvg;
    if (!floor) return null;
    if (floor.underlayUrl && isSvgUnderlay(floor.underlayUrl)) {
      toast.error("Still loading the drawing…");
      return null;
    }
    const w = floor.calibration?.widthPx || 1000;
    const h = floor.calibration?.heightPx || 1000;
    const next = serializeSvg(
      floor.underlayUrl ? wrapRasterAsSvg(floor.underlayUrl, w, h) : blankVenueSvg(w, h),
    );
    setVenueSvg(next);
    commitVenueSvg(next);
    return next;
  }

  function beginVenueDraw(nextTool: Tool) {
    if (!ensureVenueDrawing()) return;
    setEditVenueLayers(true);
    setPresetId("none");
    setStampAppearance(null);
    setStampModelId(null);
    setTool(nextTool);
  }

  async function renameFloor(id: string, name: string) {
    const trimmed = name.trim() || "Level";
    markHistory();
    setSaveLabel("Saving…");
    const res = await fetch(`/api/floors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      toast.error("Could not rename floor");
      setSaveLabel("Saved");
      return;
    }
    const updated = (await res.json()) as Floor;
    setBundle((b) => ({
      ...b,
      floors: b.floors.map((f) => (f.id === updated.id ? { ...f, name: updated.name } : f)),
    }));
    markSaved();
  }

  async function applyFloorCount(raw: string) {
    const n = Math.max(1, Math.min(4, Math.round(Number(raw)) || 1));
    const current = floorsSorted;
    if (n === current.length) return;

    if (n < current.length) {
      const removed = current.slice(n);
      const hasWork = removed.some(
        (f) => f.underlayUrl || bundle.objects.some((o) => o.floorId === f.id),
      );
      if (hasWork) {
        const ok = window.confirm(
          `Remove ${removed.length} level${removed.length === 1 ? "" : "s"}? Drawings and objects on those levels will be deleted.`,
        );
        if (!ok) return;
      }
    }

    markHistory();
    setBusy(true);
    setSaveLabel("Saving…");
    try {
      if (n > current.length) {
        const created: Floor[] = [];
        for (let i = current.length; i < n; i++) {
          const res = await fetch(`/api/events/${bundle.event.slug}/floors`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: `Level ${i + 1}` }),
          });
          if (!res.ok) throw new Error("Could not add floor");
          created.push((await res.json()) as Floor);
        }
        setBundle((b) => ({ ...b, floors: [...b.floors, ...created] }));
        setFloorId(created[created.length - 1].id);
      } else {
        const keep = current.slice(0, n);
        const dropIds = new Set(current.slice(n).map((f) => f.id));
        for (const id of dropIds) {
          const res = await fetch(`/api/floors/${id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Could not remove floor");
        }
        setBundle((b) => ({
          ...b,
          floors: keep,
          objects: b.objects.filter((o) => !dropIds.has(o.floorId)),
        }));
        if (floorId && dropIds.has(floorId)) setFloorId(keep[keep.length - 1]?.id ?? "");
      }
      markSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update floors");
      setSaveLabel("Saved");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${bundle.event.slug}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      toast.success("Published");
      window.open(`/e/${bundle.event.slug}`, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function bindSponsor(s: Sponsor | null) {
    if (!selected || selected.kind !== "booth") return;
    await patchObject({
      ...selected,
      sponsorId: s?.id ?? null,
      name: s ? selected.name || s.name : selected.name,
      boothNumber: s ? selected.boothNumber || s.boothNumber : selected.boothNumber,
    });
  }

  async function deleteSelected() {
    const ids = selectedIds.filter((id) => id !== VENUE_ID);
    if (!ids.length) return;
    markHistory();
    setSaveLabel("Saving…");
    setBundle((b) => ({ ...b, objects: b.objects.filter((o) => !ids.includes(o.id)) }));
    setSelectedIds([]);
    await Promise.all(ids.map((id) => fetch(`/api/objects/${id}`, { method: "DELETE" })));
    markSaved();
  }

  useEffect(() => {
    function inPalette(el: EventTarget | null) {
      return (
        el instanceof HTMLElement &&
        Boolean(el.closest("[data-slot='command'], [data-slot='popover-content']"))
      );
    }

    function selectedForClipboard() {
      const ids = new Set(selectedIds.filter((id) => id !== VENUE_ID));
      if (!ids.size) return [];
      return objects.filter((o) => ids.has(o.id));
    }

    function copySelected(e: ClipboardEvent | KeyboardEvent) {
      const items = selectedForClipboard();
      if (!items.length) return false;
      e.preventDefault();
      objectClipboardRef.current = items;
      pasteGenRef.current = 1;
      const payload = CLIP_PREFIX + JSON.stringify(items);
      if (e instanceof ClipboardEvent) {
        e.clipboardData?.setData("text/plain", payload);
      } else {
        void navigator.clipboard.writeText(payload).catch(() => {});
      }
      return true;
    }

    function pasteObjects(sources: MapObject[]) {
      if (!floor || !sources.length) return;
      const n = pasteGenRef.current++;
      const dx = n * PASTE_NUDGE_M;
      const copies = sources.map((o) => cloneObjectAt(o, floor.id, dx, dx));
      void createObjects(copies);
    }

    function onCopy(e: ClipboardEvent) {
      if (isTypingTarget(e.target) || inPalette(e.target)) return;
      copySelected(e);
    }

    function onPaste(e: ClipboardEvent) {
      if (isTypingTarget(e.target) || inPalette(e.target)) return;
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const parsed = parseCopiedObjects(text);
      const sources = parsed ?? (text.trim() ? null : objectClipboardRef.current);
      if (!sources?.length) return;
      e.preventDefault();
      pasteObjects(sources);
    }

    function onCut(e: ClipboardEvent) {
      if (isTypingTarget(e.target) || inPalette(e.target)) return;
      if (!copySelected(e)) return;
      void deleteSelected();
    }

    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || inPalette(e.target)) return;
      const chord = e.metaKey || e.ctrlKey;
      if (chord && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) void redo();
        else void undo();
        return;
      }
      if (chord && e.key.toLowerCase() === "y") {
        e.preventDefault();
        void redo();
        return;
      }
      if (chord && e.key.toLowerCase() === "d") {
        if (e.repeat) return;
        const items = selectedForClipboard();
        if (!items.length) return;
        e.preventDefault();
        pasteGenRef.current = 1;
        pasteObjects(items);
        return;
      }
      if (chord && e.key.toLowerCase() === "c") {
        copySelected(e);
        return;
      }
      if (chord && e.key.toLowerCase() === "x") {
        if (copySelected(e)) void deleteSelected();
        return;
      }
      if (chord) return;
      if (e.key === "Escape") {
        setTool("select");
        setPresetId("none");
      }
      if (e.key === "0") {
        setFitNonce((n) => n + 1);
      }
      if (e.key === "v" || e.key === "V") {
        setSidebarTab("objects");
        if (selectedId === VENUE_ID) setSelectedIds([]);
        setTool("select");
      }
      if (e.key === "r" || e.key === "R") {
        if (
          viewMode === "hall" &&
          tool === "select" &&
          selected?.kind === "booth" &&
          selected.polygon
        ) {
          e.preventDefault();
          const rotated = commitShape(rotateBezier(objectShape(selected), 45));
          void patchObject({
            ...selected,
            polygon: rotated.polygon,
            path: rotated.path,
            facingDeg: (selected.facingDeg ?? 0) + 45,
            rotation: (selected.rotation ?? 0) + 45,
          });
          return;
        }
        if (sidebarTab === "venue") {
          beginVenueDraw("rect");
          return;
        }
        setSidebarTab("objects");
        setStampAppearance(null);
        setStampModelId(null);
        setPresetId("none");
        setTool("rect");
      }
      if (e.key === "p" || e.key === "P") {
        if (sidebarTab === "venue") {
          beginVenueDraw("polygon");
          return;
        }
        setSidebarTab("objects");
        setTool("polygon");
      }
      if (e.key === "i" || e.key === "I") {
        setSidebarTab("objects");
        setTool("icon");
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const venue = venueEditRef.current;
        if (venue.tab === "venue" && venue.els.length && venue.svg) {
          e.preventDefault();
          let next = venue.svg;
          for (const id of venue.els) next = deleteSvgLayer(next, id);
          commitVenueSvg(next);
          setSelectedVenueEl(null);
          setSelectedVenueEls([]);
          return;
        }
        if (sidebarTab === "objects") void deleteSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("copy", onCopy);
    window.addEventListener("paste", onPaste);
    window.addEventListener("cut", onCut);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("cut", onCut);
    };
  });

  const viewerUrl = `/e/${bundle.event.slug}`;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border px-3 py-0">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/events" className="chrome-kicker py-3 hover:text-primary">
            Maps
          </Link>
          <span className="text-border">/</span>
          <h1 className="truncate text-[13px] font-medium">{bundle.event.name}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="outline"
            title="Fit drawing and objects (0)"
            onClick={() => setFitNonce((n) => n + 1)}
          >
            <Maximize2 />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            title="Undo"
            disabled={!canUndo || busy}
            onClick={() => void undo()}
          >
            <Undo2 />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            title="Redo"
            disabled={!canRedo || busy}
            onClick={() => void redo()}
          >
            <Redo2 />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                title="Versions"
                className="min-w-0 gap-1 px-2 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase hover:text-primary"
              >
                {saveLabel === "Saving…"
                  ? "Saving…"
                  : lastSavedAt
                    ? `Saved ${formatSavedWhen(lastSavedAt, new Date(nowTick))}`
                    : "Saved"}
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-56">
              <DropdownMenuLabel>Versions</DropdownMenuLabel>
              {versions.length ? (
                versions.map((v) => (
                  <DropdownMenuItem key={v.id} onClick={() => void restoreVersion(v.id)}>
                    {new Date(v.createdAt).toLocaleString()}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No saved versions yet</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  snapshotVersion(true);
                  toast.message("Captured last saved state");
                }}
              >
                Save version now
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <GridToggle value={showGrid} onChange={setShowGrid} />
          <ViewModeToggle
            value={viewMode}
            onChange={(mode) => {
              setViewMode(mode);
              if (mode === "hall" && tool === "calibrate") setTool("select");
            }}
          />
          <UnitsToggle units={units} onChange={setUnits} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button size="sm" variant="outline" asChild>
            <Link href={`/e/${bundle.event.slug}/assets`}>Assets</Link>
          </Button>
          <Button size="sm" onClick={() => void publish()} disabled={busy}>
            Publish
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={viewerUrl} target="_blank">
              Viewer
            </Link>
          </Button>
          <Button size="icon-sm" variant="ghost" asChild>
            <Link href={`/e/${bundle.event.slug}/settings`} aria-label="Settings" title="Settings">
              <Settings />
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[260px] min-h-0 shrink-0 flex-col overflow-hidden border-r border-border bg-background md:flex">
          <div className="flex border-b border-border">
            {(
              [
                ["objects", "Objects"],
                ["venue", "Venue"],
                ["map", "Map"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`flex-1 px-2 py-2 text-xs font-medium ${
                  sidebarTab === id
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  setSidebarTab(id);
                  if (id === "venue") {
                    setSelectedIds([VENUE_ID]);
                    setTool("select");
                    setPresetId("none");
                  } else {
                    if (selectedId === VENUE_ID) setSelectedIds([]);
                    if (tool === "calibrate") setTool("select");
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {sidebarTab === "objects" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-2 border-b border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Booths and icons. Switch to Venue to resize the drawing.
                </p>
                {floorsSorted.length > 1 ? (
                  <Select
                    value={floor?.id}
                    onValueChange={(id) => {
                      setFloorId(id);
                      setSelectedIds([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select floor" />
                    </SelectTrigger>
                    <SelectContent>
                      {floorsSorted.map((f, i) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name || `Level ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      className="w-full"
                      variant={tool === "select" || tool === "calibrate" ? "outline" : "default"}
                    >
                      <Plus />
                      Add new
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-52">
                    <DropdownMenuLabel>Booth presets</DropdownMenuLabel>
                    {PRESETS.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => {
                          setStampAppearance(null);
                          setStampModelId(null);
                          setPresetId(p.id);
                          setTool("rect");
                        }}
                      >
                        {p.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setStampAppearance("stage");
                        setStampModelId(null);
                        setPresetId("stage");
                        setTool("rect");
                      }}
                    >
                      <Theater />
                      Stage
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setStampAppearance(null);
                        setStampModelId(null);
                        setPresetId("none");
                        setTool("rect");
                      }}
                    >
                      <Square />
                      Rectangle
                      <DropdownMenuShortcut>R</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setStampAppearance(null);
                        setStampModelId(null);
                        setPresetId("none");
                        setTool("polygon");
                      }}
                    >
                      <Pentagon />
                      Polygon
                      <DropdownMenuShortcut>P</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <MapPin />
                        Icon
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {AMENITIES.map((a) => (
                          <DropdownMenuItem
                            key={a.type}
                            onClick={() => {
                              setStampAppearance(null);
                              setStampModelId(null);
                              setAmenityStamp(a.type);
                              setTool("icon");
                            }}
                          >
                            {a.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Box />
                        Library model
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {bundle.assets
                          .filter((a) => a.kind === "model")
                          .map((a) => (
                            <DropdownMenuItem
                              key={a.id}
                              onClick={() => {
                                setStampAppearance("custom");
                                setStampModelId(a.id);
                                setPresetId("3x3m");
                                setTool("rect");
                              }}
                            >
                              {a.name}
                            </DropdownMenuItem>
                          ))}
                        {!bundle.assets.some((a) => a.kind === "model") ? (
                          <DropdownMenuItem disabled>Upload a GLB in Assets → Library</DropdownMenuItem>
                        ) : null}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
                {tool === "rect" ? (
                  <p className="text-[11px] text-primary">
                    {presetId && presetId !== "none"
                      ? `Click the ${viewMode === "hall" ? "hall floor" : "plan"} to place a ${
                          presetId === "stage"
                            ? "stage"
                            : PRESETS.find((p) => p.id === presetId)?.label ?? "booth"
                        }.`
                      : `Drag on the ${viewMode === "hall" ? "hall floor" : "plan"} to draw a rectangle. Esc cancels.`}
                  </p>
                ) : null}
                {tool === "polygon" ? (
                  <p className="text-[11px] text-primary">
                    {viewMode === "hall"
                      ? "Switch to Plan to trace a polygon. Esc cancels."
                      : "Click a corner; drag for Bézier handles. Click the first point or Enter to close. Alt-drag breaks handle symmetry."}
                  </p>
                ) : null}
                {tool === "icon" ? (
                  <p className="text-[11px] text-primary">
                    Click the {viewMode === "hall" ? "hall floor" : "plan"} to place{" "}
                    {amenityLabel(amenityStamp).toLowerCase()}. Esc cancels.
                  </p>
                ) : null}
              </div>
              <div
                className="flex shrink-0 items-center gap-0.5 border-b border-border px-3 py-1.5"
                role="tablist"
                aria-label="Filter objects"
              >
                {OBJECT_FILTERS.map((tab) => {
                  const Icon = tab.icon;
                  const active = objectFilter === tab.value;
                  return (
                    <Tooltip key={tab.value}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          role="tab"
                          aria-label={tab.label}
                          aria-selected={active}
                          data-active={active}
                          onClick={() => setObjectFilter(tab.value)}
                          className={`flex size-7 items-center justify-center rounded-md transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                          }`}
                        >
                          <Icon className="size-3.5" strokeWidth={1.75} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{tab.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Sort objects"
                          className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                        >
                          <ChevronDown
                            className={`size-3.5 ${objectSortDir === "desc" ? "rotate-180" : ""}`}
                            strokeWidth={1.75}
                          />
                        </button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Sort</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="min-w-40">
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={objectSort}
                      onValueChange={(v) => setObjectSort(v as ObjectSort)}
                    >
                      <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="size">Size</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="modified">Last modified</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={objectSortDir}
                      onValueChange={(v) => setObjectSortDir(v as SortDir)}
                    >
                      <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div className="py-1">
                  {listedObjects.map((o) => {
                    const s = o.sponsorId
                      ? bundle.sponsors.find((sp) => sp.id === o.sponsorId)
                      : undefined;
                    const title = objectTitle(o, s);
                    const sub =
                      o.kind === "amenity"
                        ? "Icon"
                        : o.polygon
                          ? formatSize(ringBounds(o.polygon).w, ringBounds(o.polygon).h, units)
                          : isStage(o)
                            ? "Stage"
                            : "Booth";
                    return (
                      <button
                        key={o.id}
                        type="button"
                        data-active={selectedIds.includes(o.id)}
                        onClick={(e) => {
                          if (e.shiftKey) {
                            setSelectedIds((ids) =>
                              ids.includes(o.id) ? ids.filter((id) => id !== o.id) : [...ids.filter((id) => id !== VENUE_ID), o.id],
                            );
                          } else {
                            setSelectedIds([o.id]);
                          }
                          setTool("select");
                        }}
                        onDoubleClick={() => {
                          setSelectedIds([o.id]);
                          setTool("select");
                          setFrameNonce((n) => n + 1);
                        }}
                        className="chrome-row"
                      >
                        {s?.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.logoUrl} alt="" className="h-6 w-6 bg-white object-contain p-0.5" />
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{title}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{sub}</span>
                      </button>
                    );
                  })}
                  {!listedObjects.length ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      No {objectFilter === "all" ? "objects" : objectFilter} on this plan.
                    </p>
                  ) : null}
                </div>
              </ScrollArea>
            </div>
          ) : sidebarTab === "map" ? (
            <div className="min-h-0 overflow-auto p-3">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Pan and zoom move the drawing and the map together. Turn on align to drag the hall onto the streets. Lat/lng arrows move about 1 m.
                </p>
                <label className="flex items-center justify-between gap-2 text-sm">
                  <span>Show OpenStreetMap</span>
                  <input
                    type="checkbox"
                    checked={Boolean(floor?.basemap?.enabled)}
                    onChange={(e) => {
                      const prev = floor?.basemap ?? DEFAULT_FLOOR_BASEMAP;
                      void patchBasemap({ ...prev, enabled: e.target.checked }, true);
                    }}
                    className="accent-primary"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-sm">
                  <span>Align drawing to map</span>
                  <input
                    type="checkbox"
                    checked={alignDrawingToMap}
                    disabled={!floor?.basemap?.enabled}
                    onChange={(e) => setAlignDrawingToMap(e.target.checked)}
                    className="accent-primary"
                  />
                </label>
                <div>
                  <Label className="chrome-kicker" htmlFor="basemap-opacity">
                    Map strength
                  </Label>
                  <input
                    id="basemap-opacity"
                    type="range"
                    min="0.15"
                    max="1"
                    step="0.05"
                    disabled={!floor?.basemap?.enabled}
                    value={floor?.basemap?.opacity ?? DEFAULT_FLOOR_BASEMAP.opacity}
                    onChange={(e) => {
                      const prev = floor?.basemap ?? DEFAULT_FLOOR_BASEMAP;
                      void patchBasemap({ ...prev, enabled: true, opacity: Number(e.target.value) });
                    }}
                    className="mt-1 w-full accent-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <Label htmlFor="basemap-lat" className="text-[10px] text-muted-foreground">
                      Latitude
                    </Label>
                    <Input
                      id="basemap-lat"
                      type="number"
                      step={BASEMAP_COORD_STEP}
                      disabled={!floor?.basemap?.enabled}
                      value={floor?.basemap?.lat ?? ""}
                      onChange={(e) => {
                        const prev = floor?.basemap ?? DEFAULT_FLOOR_BASEMAP;
                        const lat = Number(e.target.value);
                        if (!Number.isFinite(lat)) return;
                        void patchBasemap({ ...prev, enabled: true, lat: roundBasemapCoord(lat) });
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="basemap-lng" className="text-[10px] text-muted-foreground">
                      Longitude
                    </Label>
                    <Input
                      id="basemap-lng"
                      type="number"
                      step={BASEMAP_COORD_STEP}
                      disabled={!floor?.basemap?.enabled}
                      value={floor?.basemap?.lng ?? ""}
                      onChange={(e) => {
                        const prev = floor?.basemap ?? DEFAULT_FLOOR_BASEMAP;
                        const lng = Number(e.target.value);
                        if (!Number.isFinite(lng)) return;
                        void patchBasemap({ ...prev, enabled: true, lng: roundBasemapCoord(lng) });
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="chrome-kicker" htmlFor="basemap-bearing">
                      Rotation
                    </Label>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {wrapBearingDeg(floor?.basemap?.bearing ?? 0)}°
                    </span>
                  </div>
                  <input
                    id="basemap-bearing"
                    type="range"
                    min="-180"
                    max="180"
                    step="0.5"
                    disabled={!floor?.basemap?.enabled}
                    value={bearingSliderValue(floor?.basemap?.bearing ?? 0)}
                    onChange={(e) => {
                      const prev = floor?.basemap ?? DEFAULT_FLOOR_BASEMAP;
                      const bearing = wrapBearingDeg(Number(e.target.value));
                      void patchBasemap({ ...prev, enabled: true, bearing });
                    }}
                    className="mt-1 w-full accent-primary"
                  />
                </div>
                <div>
                  <Label htmlFor="basemap-zoom" className="text-[10px] text-muted-foreground">
                    Zoom
                  </Label>
                  <Input
                    id="basemap-zoom"
                    type="number"
                    min="1"
                    max="22"
                    step="0.1"
                    className="tabular-nums"
                    disabled={!floor?.basemap?.enabled}
                    value={derivedMapZoom ?? floor?.basemap?.zoom ?? ""}
                    onChange={(e) => {
                      const zoom = Number(e.target.value);
                      if (!Number.isFinite(zoom)) return;
                      setDerivedMapZoom(zoom);
                    }}
                    onBlur={(e) => {
                      const zoom = Number(e.target.value);
                      if (!Number.isFinite(zoom)) return;
                      setMapZoomTo((n) => ({ zoom: Math.min(22, Math.max(1, zoom)), nonce: (n?.nonce ?? 0) + 1 }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const zoom = Number((e.target as HTMLInputElement).value);
                      if (!Number.isFinite(zoom)) return;
                      setMapZoomTo((n) => ({ zoom: Math.min(22, Math.max(1, zoom)), nonce: (n?.nonce ?? 0) + 1 }));
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-0 overflow-auto p-3">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Edit the drawing, underlay, and scale. Booths stay on the Objects tab.
                </p>
                <div>
                  <Label className="chrome-kicker">Floors / levels</Label>
                  <Select
                    value={String(Math.min(4, Math.max(1, floorsSorted.length)))}
                    onValueChange={(value) => void applyFloorCount(value)}
                    disabled={busy}
                  >
                    <SelectTrigger className="mt-1" aria-label="Floors / levels">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["1", "2", "3", "4"].map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    More than one level gets its own drawing. Booths stay on the active level.
                  </p>
                </div>

                {floorsSorted.length > 1 ? (
                  <div className="space-y-2">
                    <Label className="chrome-kicker">Level names</Label>
                    {floorsSorted.map((f, i) => (
                      <Input
                        key={f.id}
                        defaultValue={f.name}
                        placeholder={`Level ${i + 1}`}
                        onBlur={(e) => {
                          if (e.target.value.trim() !== f.name) void renameFloor(f.id, e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                        }}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <Label className="chrome-kicker">Underlay</Label>
                  <p className="text-xs text-muted-foreground">
                    PDF, PNG, JPG, or SVG. Then enter the hall width and height
                    {floorsSorted.length > 1 ? " for the active level" : ""}.
                  </p>
                  {(floorsSorted.length > 1 ? floorsSorted : floorsSorted.slice(0, 1)).map((f, i) => (
                    <div key={f.id} className={floorsSorted.length > 1 ? "space-y-1 border border-border p-2" : "space-y-1"}>
                      {floorsSorted.length > 1 ? (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-medium">{f.name || `Level ${i + 1}`}</p>
                          <button
                            type="button"
                            className="text-[10px] text-muted-foreground hover:text-primary"
                            onClick={() => {
                              setFloorId(f.id);
                              setSelectedIds([]);
                            }}
                          >
                            {f.id === floor?.id ? "Editing" : "Edit"}
                          </button>
                        </div>
                      ) : null}
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadUnderlay(file, f.id);
                          e.target.value = "";
                        }}
                      />
                      {f.underlayUrl || f.originalUrl ? (
                        <div className="relative">
                          <UnderlayPreview
                            floor={f}
                            svgMarkup={f.id === floor?.id ? venueSvg : null}
                            faded={f.id === floor?.id && !showUnderlay}
                          />
                          {f.id === floor?.id ? (
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="outline"
                              className="absolute top-1 right-1 bg-background/90"
                              aria-label={showUnderlay ? "Hide drawing" : "Show drawing"}
                              title={showUnderlay ? "Hide drawing" : "Show drawing"}
                              onClick={() => setShowUnderlay((v) => !v)}
                            >
                              {showUnderlay ? <Eye /> : <EyeOff />}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {f.underlayUrl ? "Drawing attached" : "No drawing yet"}
                        {f.id === floor?.id && f.underlayUrl && !showUnderlay ? " · hidden" : ""}
                      </p>
                    </div>
                  ))}
                  <Label className="chrome-kicker" htmlFor="underlay-opacity">
                    Drawing strength
                  </Label>
                  <input
                    id="underlay-opacity"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={underlayOpacity}
                    onChange={(e) => setUnderlayOpacity(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div>
                  <Label className="chrome-kicker">Venue size</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Overall width and height of{" "}
                    {floorsSorted.length > 1 ? `${floor?.name || "this level"}’s` : "the drawing’s"} bounding box.
                    Booths keep their real size.
                  </p>
                  <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-1">
                    <div>
                      <Label htmlFor="venue-width" className="text-[10px] text-muted-foreground">
                        Width
                      </Label>
                      <Input
                        id="venue-width"
                        type="number"
                        min="0.01"
                        step="any"
                        value={venueWidth}
                        onChange={(e) => onVenueWidthChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void applyVenueBounds();
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="venue-height" className="text-[10px] text-muted-foreground">
                        Height
                      </Label>
                      <Input
                        id="venue-height"
                        type="number"
                        min="0.01"
                        step="any"
                        value={venueHeight}
                        onChange={(e) => onVenueHeightChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void applyVenueBounds();
                        }}
                      />
                    </div>
                    <span className="mb-2 w-8 shrink-0 text-xs text-muted-foreground">{units}</span>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={constrainProportions}
                      onChange={(e) => setConstrainProportions(e.target.checked)}
                      className="size-3.5 accent-primary"
                    />
                    Constrain proportions (handles)
                  </label>
                  <Button size="sm" className="mt-2" variant="outline" onClick={() => void applyVenueBounds()}>
                    Apply size
                  </Button>
                </div>

                <div>
                  <Label className="chrome-kicker">Drawing layers</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Draw walls on top of an attached plan, or click existing shapes to hide, delete, and reorder.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant={editVenueLayers ? "default" : "outline"}
                      onClick={() => {
                        if (editVenueLayers) {
                          setEditVenueLayers(false);
                          setSelectedVenueEl(null);
                          setSelectedVenueEls([]);
                          setTool("select");
                          return;
                        }
                        if (!ensureVenueDrawing()) return;
                        setEditVenueLayers(true);
                        setSelectedVenueEl(null);
                        setSelectedVenueEls([]);
                      }}
                    >
                      {editVenueLayers ? "Done" : "Edit venue"}
                    </Button>
                    <Button
                      size="sm"
                      variant={editVenueLayers && tool === "rect" ? "default" : "outline"}
                      onClick={() => beginVenueDraw("rect")}
                    >
                      <Square />
                      Rect
                    </Button>
                    <Button
                      size="sm"
                      variant={editVenueLayers && tool === "polygon" ? "default" : "outline"}
                      onClick={() => beginVenueDraw("polygon")}
                    >
                      <Pentagon />
                      Polygon
                    </Button>
                  </div>
                  {editVenueLayers && venueSvg ? (
                    <VenueLayersEditor
                      layers={(() => {
                        try {
                          return listSvgLayers(venueSvg);
                        } catch {
                          return [];
                        }
                      })()}
                      hoverId={hoverLayerId}
                      selectedIds={selectedVenueEls}
                      onHover={setHoverLayerId}
                      onSelect={selectVenueLayer}
                      onToggleHidden={(id, hidden) => commitVenueSvg(setSvgLayerHidden(venueSvg, id, hidden))}
                      onToggleLocked={(id, locked) => commitVenueSvg(setSvgLayerLocked(venueSvg, id, locked))}
                      onDelete={(id) => {
                        commitVenueSvg(deleteSvgLayer(venueSvg, id));
                        setSelectedVenueEls((prev) => {
                          const next = prev.filter((x) => x !== id);
                          setSelectedVenueEl(next[next.length - 1] ?? null);
                          return next;
                        });
                      }}
                      onReorder={(parentId, ids) => commitVenueSvg(reorderSvgSiblings(venueSvg, parentId, ids))}
                      onReparent={(id, newParentId, beforeId) =>
                        commitVenueSvg(reparentSvgLayer(venueSvg, id, newParentId, beforeId))
                      }
                      onRename={(id, name) => commitVenueSvg(setSvgLayerName(venueSvg, id, name))}
                      onRenameText={(id, text) => commitVenueSvg(setSvgLayerText(venueSvg, id, text))}
                      onGroup={groupSelectedVenueLayers}
                      onUngroup={ungroupVenueLayer}
                    />
                  ) : null}
                </div>

                <div>
                  <Label className="chrome-kicker">Scale</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Or enter a known length, then click its two ends on the drawing.
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    <Input
                      type="number"
                      min="0.01"
                      step="any"
                      value={scaleLength}
                      onChange={(e) => setScaleLength(e.target.value)}
                      aria-label="Known length"
                    />
                    <span className="w-8 shrink-0 text-xs text-muted-foreground">{units}</span>
                  </div>
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant={tool === "calibrate" ? "default" : "outline"}
                      disabled={viewMode === "hall"}
                      onClick={() => setTool(tool === "calibrate" ? "select" : "calibrate")}
                    >
                      {tool === "calibrate" ? "Cancel scale" : "Set scale"}
                    </Button>
                  </div>
                </div>

                {floor?.calibration ? (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {formatSize(floorSizeMeters(floor.calibration).w, floorSizeMeters(floor.calibration).h, units, 2)} ·{" "}
                    {floor.calibration.widthPx}×{floor.calibration.heightPx} px
                  </p>
                ) : (
                  <p className="text-[11px] text-primary">No size yet. Import a drawing and enter width and height.</p>
                )}
              </div>
            </div>
          )}
        </aside>

        <main className="relative min-w-0 flex-1">
          {floor ? (
            viewMode === "hall" ? (
              <HallCanvas
                mode="edit"
                floor={floor}
                objects={objects}
                sponsors={bundle.sponsors}
                assets={bundle.assets}
                selectedId={selectedId}
                frameNonce={frameNonce}
                fitNonce={fitNonce}
                tool={tool}
                units={units}
                amenityStamp={amenityStamp}
                presetMeters={presetId && presetId !== "none" ? preset : null}
                stampAppearance={stampAppearance}
                stampModelAssetId={stampModelId}
                showGrid={showGrid}
                onSelect={(id) => setSelectedIds(id ? [id] : [])}
                onChangeObject={(o) => void patchObject(o)}
                onCreateObject={(o) => {
                  void createObject(o);
                  setTool("select");
                  setPresetId("none");
                  setStampAppearance(null);
                  setStampModelId(null);
                }}
              />
            ) : (
              <FloorCanvas
                mode="edit"
                floor={floor}
                objects={objects}
                sponsors={bundle.sponsors}
                assets={bundle.assets}
                selectedId={selectedId}
                selectedIds={selectedIds}
                frameNonce={frameNonce}
                fitNonce={fitNonce}
                tool={tool}
                units={units}
                amenityStamp={amenityStamp}
                presetMeters={presetId && presetId !== "none" ? preset : null}
                stampAppearance={stampAppearance}
                stampModelAssetId={stampModelId}
                constrainProportions={constrainProportions}
                editLayer={sidebarTab === "venue" ? "venue" : "objects"}
                canvasInteractive={sidebarTab !== "map"}
                basemapInteractive={sidebarTab === "map"}
                basemapAlignMode={sidebarTab === "map" && alignDrawingToMap}
                onBasemapAnchorChange={(next) => {
                  const prev = floor.basemap ?? DEFAULT_FLOOR_BASEMAP;
                  void patchBasemap({ ...prev, enabled: true, ...next });
                }}
                onBasemapDerivedZoom={onBasemapDerivedZoom}
                basemapZoomTo={mapZoomTo}
                onSelect={(id) => setSelectedIds(id ? [id] : [])}
                onSelectIds={setSelectedIds}
                onChangeObject={(o) => void patchObject(o)}
                onChangeObjects={(objs) => void patchObjects(objs)}
                onCreateObject={(o) => {
                  void createObject(o);
                  setTool("select");
                  setPresetId("none");
                  setStampAppearance(null);
                  setStampModelId(null);
                }}
                onCalibrated={(n, p) => void onCalibrated(n, p)}
                knownLengthMeters={toMeters(Number(scaleLength), units)}
                underlayOpacity={underlayOpacity}
                showGrid={showGrid}
                underlaySvg={venueSvg}
                showUnderlay={showUnderlay}
                underlayHoverLayerId={editVenueLayers ? hoverLayerId : null}
                editVenueElements={editVenueLayers}
                selectedVenueElementId={editVenueLayers ? selectedVenueEl : null}
                onHoverVenueElement={setHoverLayerId}
                onSelectVenueElement={(id) => selectVenueLayer(id)}
                onPreviewVenueSvg={setVenueSvg}
                onCommitVenueSvg={(svg) => commitVenueSvg(svg)}
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Set the number of floors to start.
            </div>
          )}
          <div className="pointer-events-none absolute top-3 left-3 z-20">
            <div className="pointer-events-auto">
              <FloorSwitcher
                floors={floorsSorted}
                value={floor?.id ?? ""}
                onChange={(id) => {
                  setFloorId(id);
                  setSelectedIds([]);
                  setFitNonce((n) => n + 1);
                }}
              />
            </div>
          </div>
          {tool === "calibrate" ? (
            <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-md border border-primary/40 bg-background/80 px-3 py-1.5 text-xs text-foreground">
              {Number(scaleLength) > 0
                ? `Click two ends of ${scaleLength} ${units}. Hold Space to pan.`
                : "Enter a known length in the Venue panel, then click two ends."}
            </div>
          ) : sidebarTab === "venue" && (tool === "rect" || tool === "polygon") ? (
            <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-md border border-primary/40 bg-background/80 px-3 py-1.5 text-xs text-foreground">
              {tool === "polygon"
                ? "Click to add a corner; click-drag for curves. Enter closes. Hold Space to pan."
                : "Drag a rectangle on the venue. Hold Space to pan."}
            </div>
          ) : null}
        </main>

        <aside className="hidden w-[260px] min-h-0 shrink-0 flex-col overflow-hidden border-l border-border bg-background lg:flex">
          <ScrollArea className="min-h-0 flex-1">
          <div className="border-b border-border p-3">
            <p className="chrome-kicker">Inspector</p>
            {selectedVenueLayer && venueSvg ? (
              <div className="mt-2 space-y-2">
                <p className="font-mono text-[10px] text-muted-foreground uppercase">{selectedVenueLayer.kind}</p>
                <div>
                  <Label htmlFor="insp-venue-name" className="text-[10px] text-muted-foreground">
                    Name
                  </Label>
                  <Input
                    id="insp-venue-name"
                    value={selectedVenueLayer.name}
                    onChange={(e) => commitVenueSvg(setSvgLayerName(venueSvg, selectedVenueLayer.id, e.target.value))}
                  />
                </div>
                {selectedVenueMetrics ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Size</p>
                      <p className="text-sm tabular-nums">{formatSize(selectedVenueMetrics.w, selectedVenueMetrics.h, units, 2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Area</p>
                      <p className="text-sm tabular-nums">{formatArea(selectedVenueMetrics.area, units, 2)}</p>
                    </div>
                  </div>
                ) : null}
                {selectedVenueLayer.text != null ? (
                  <div>
                    <Label htmlFor="insp-venue-label" className="text-[10px] text-muted-foreground">
                      Label
                    </Label>
                    <Input
                      id="insp-venue-label"
                      value={selectedVenueLayer.text}
                      onChange={(e) => commitVenueSvg(setSvgLayerText(venueSvg, selectedVenueLayer.id, e.target.value))}
                    />
                  </div>
                ) : null}
                {selectedVenueLayer.kind !== "image" && selectedVenuePaint ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="w-12 text-[10px] font-normal text-muted-foreground">Fill</Label>
                      <input
                        type="color"
                        aria-label="Fill color"
                        value={paintToHex(selectedVenuePaint.fill, "#f4f0e6")}
                        onChange={(e) =>
                          commitVenueSvg(setSvgElementPaint(venueSvg, selectedVenueLayer.id, { fill: e.target.value }))
                        }
                        className="size-8 shrink-0 cursor-pointer border border-input bg-background p-0.5"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          commitVenueSvg(setSvgElementPaint(venueSvg, selectedVenueLayer.id, { fill: "none" }))
                        }
                      >
                        None
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="w-12 text-[10px] font-normal text-muted-foreground">Stroke</Label>
                      <input
                        type="color"
                        aria-label="Stroke color"
                        value={paintToHex(selectedVenuePaint.stroke, "#1a1a1a")}
                        onChange={(e) =>
                          commitVenueSvg(
                            setSvgElementPaint(venueSvg, selectedVenueLayer.id, { stroke: e.target.value }),
                          )
                        }
                        className="size-8 shrink-0 cursor-pointer border border-input bg-background p-0.5"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          commitVenueSvg(setSvgElementPaint(venueSvg, selectedVenueLayer.id, { stroke: "none" }))
                        }
                      >
                        None
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="insp-venue-rot" className="text-[10px] text-muted-foreground">
                    Rotation
                  </Label>
                  <div className="mt-1 flex items-center gap-1">
                    <Input
                      id="insp-venue-rot"
                      type="number"
                      step="any"
                      value={Number(svgElementRotation(venueSvg, selectedVenueLayer.id).toFixed(2))}
                      onChange={(e) => {
                        const deg = Number(e.target.value);
                        if (!Number.isFinite(deg)) return;
                        commitVenueSvg(setSvgElementRotation(venueSvg, selectedVenueLayer.id, deg));
                      }}
                    />
                    <span className="shrink-0 text-[10px] text-muted-foreground">°</span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        commitVenueSvg(
                          setSvgElementRotation(
                            venueSvg,
                            selectedVenueLayer.id,
                            svgElementRotation(venueSvg, selectedVenueLayer.id) - 45,
                          ),
                        )
                      }
                    >
                      −45°
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        commitVenueSvg(
                          setSvgElementRotation(
                            venueSvg,
                            selectedVenueLayer.id,
                            svgElementRotation(venueSvg, selectedVenueLayer.id) + 45,
                          ),
                        )
                      }
                    >
                      +45°
                    </Button>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={selectedVenueLayer.hidden}
                    onChange={(e) =>
                      commitVenueSvg(setSvgLayerHidden(venueSvg, selectedVenueLayer.id, e.target.checked))
                    }
                  />
                  Hidden
                </label>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={selectedVenueLayer.locked}
                    onChange={(e) =>
                      commitVenueSvg(setSvgLayerLocked(venueSvg, selectedVenueLayer.id, e.target.checked))
                    }
                  />
                  Locked (not selectable on the drawing)
                </label>
                <p className="text-xs text-muted-foreground">
                  Drag to move or rotate from the top handle. Hold Shift while rotating to snap to 15°. Delete or Backspace removes the
                  element.
                </p>
                <Button size="sm" variant="destructive" onClick={deleteSelectedVenueElement}>
                  Delete
                </Button>
              </div>
            ) : multiSelected ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium">{selectedIds.filter((id) => id !== VENUE_ID).length} objects selected</p>
                <p className="text-xs text-muted-foreground">
                  Drag to move the group. Shift-click or shift-drag to add. Delete removes all.
                </p>
                <Button size="sm" variant="destructive" onClick={() => void deleteSelected()}>
                  Delete
                </Button>
              </div>
            ) : venueSelected && floor?.calibration ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium">Venue drawing</p>
                <p className="text-xs text-muted-foreground">
                  Hold Space and drag to pan. Drag orange handles to stretch. Shift-drag the hall to slide the drawing.
                </p>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <Label htmlFor="insp-venue-width" className="text-[10px] text-muted-foreground">
                      Width
                    </Label>
                    <Input
                      id="insp-venue-width"
                      type="number"
                      min="0.01"
                      step="any"
                      value={venueWidth}
                      onChange={(e) => onVenueWidthChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void applyVenueBounds();
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="insp-venue-height" className="text-[10px] text-muted-foreground">
                      Height
                    </Label>
                    <Input
                      id="insp-venue-height"
                      type="number"
                      min="0.01"
                      step="any"
                      value={venueHeight}
                      onChange={(e) => onVenueHeightChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void applyVenueBounds();
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : selected ? (
              <div className="mt-2 space-y-2">
                <div>
                  <Label htmlFor="insp-label" className="text-[10px] text-muted-foreground">
                    Label
                  </Label>
                  <Input
                    id="insp-label"
                    value={selected.name}
                    onChange={(e) => void patchObject({ ...selected, name: e.target.value })}
                    placeholder="Display name"
                  />
                </div>
                {selected.kind === "booth" ? (
                  <div>
                    <Label htmlFor="insp-booth-number" className="text-[10px] text-muted-foreground">
                      Booth number
                    </Label>
                    <Input
                      id="insp-booth-number"
                      value={selected.boothNumber}
                      onChange={(e) => void patchObject({ ...selected, boothNumber: e.target.value })}
                      placeholder="A12"
                    />
                  </div>
                ) : null}
                {selected.kind === "booth" ? (
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Sponsor</Label>
                    <SponsorCombobox
                      sponsors={bundle.sponsors}
                      value={selected.sponsorId}
                      onChange={(s) => void bindSponsor(s)}
                    />
                    {!bundle.sponsors.length ? (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Cache sponsors in Assets to bind this booth.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {selected.kind === "booth" && selected.polygon ? (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <Label htmlFor="booth-width" className="text-[10px] text-muted-foreground">
                          Width
                        </Label>
                        <Input
                          id="booth-width"
                          type="number"
                          min="0.01"
                          step="any"
                          value={boothWidth}
                          onChange={(e) => setBoothWidth(e.target.value)}
                          onBlur={(e) => applyBoothSize("w", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") applyBoothSize("w", boothWidth);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="booth-height" className="text-[10px] text-muted-foreground">
                          Height
                        </Label>
                        <Input
                          id="booth-height"
                          type="number"
                          min="0.01"
                          step="any"
                          value={boothHeight}
                          onChange={(e) => setBoothHeight(e.target.value)}
                          onBlur={(e) => applyBoothSize("h", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") applyBoothSize("h", boothHeight);
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Preset</Label>
                      <Select
                        value={matchingBoothPresetId(
                          ringBounds(selected.polygon).w,
                          ringBounds(selected.polygon).h,
                        )}
                        onValueChange={(id) => applyBoothPreset(id)}
                      >
                        <SelectTrigger className="mt-1 w-full" size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom</SelectItem>
                          {PRESETS.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                          <SelectItem value="stage">Stage (12 × 8 m)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={constrainProportions}
                        onChange={(e) => setConstrainProportions(e.target.checked)}
                        className="size-3.5 accent-primary"
                      />
                      Constrain proportions
                    </label>
                  </div>
                ) : null}
                {selected.kind === "booth" && selected.polygon ? (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="object-color" className="text-[11px] font-normal text-muted-foreground">
                      Color
                    </Label>
                    <input
                      id="object-color"
                      type="color"
                      value={selected.color && /^#[0-9a-fA-F]{6}$/.test(selected.color) ? selected.color : "#f97316"}
                      onChange={(e) => void patchObject({ ...selected, color: e.target.value })}
                      className="size-8 shrink-0 cursor-pointer border border-input bg-background p-0.5"
                      aria-label="Booth color"
                    />
                    {selected.color ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void patchObject({ ...selected, color: null })}
                      >
                        Reset
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {selected.kind === "booth" && selected.polygon ? (
                  <ObjectMediaFields
                    slug={slug}
                    object={selected}
                    assets={bundle.assets}
                    sponsorLogoUrl={
                      selected.sponsorId
                        ? bundle.sponsors.find((s) => s.id === selected.sponsorId)?.logoUrl
                        : undefined
                    }
                    onPatch={(o) => void patchObject(o)}
                    onAsset={(asset) =>
                      setBundle((b) => ({
                        ...b,
                        assets: b.assets.some((a) => a.id === asset.id) ? b.assets : [...b.assets, asset],
                      }))
                    }
                  />
                ) : null}
                {selected ? (
                  <div>
                    <Label htmlFor="insp-object-rot" className="text-[10px] text-muted-foreground">
                      Rotation
                    </Label>
                    <div className="mt-1 flex items-center gap-1">
                      <Input
                        id="insp-object-rot"
                        type="number"
                        step="any"
                        value={Number(((selected.kind === "amenity" ? selected.rotation : selected.facingDeg) ?? 0).toFixed(2))}
                        onChange={(e) => applyObjectRotation(Number(e.target.value))}
                      />
                      <span className="shrink-0 text-[10px] text-muted-foreground">°</span>
                    </div>
                    <div className="mt-1 flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyObjectRotation(((selected.kind === "amenity" ? selected.rotation : selected.facingDeg) ?? 0) - 45)}
                    >
                      −45°
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => applyObjectRotation(((selected.kind === "amenity" ? selected.rotation : selected.facingDeg) ?? 0) + 45)}
                    >
                      +45°
                    </Button>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Drag the top handle on the plan for any angle. Hold Shift to snap to 15°.
                    </p>
                  </div>
                ) : null}
                <Button size="sm" variant="destructive" onClick={() => void deleteSelected()}>
                  Delete
                </Button>
                {selected.kind === "booth" && selected.polygon ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="chrome-kicker">Hall</p>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Appearance</Label>
                      <Select
                        value={resolveAppearance(selected)}
                        onValueChange={(v) =>
                          void patchObject({ ...selected, appearance: v as Appearance })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="booth">Booth</SelectItem>
                          <SelectItem value="stage">Stage</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Rug texture</Label>
                      <Select
                        value={selected.rugTextureAssetId ?? "none"}
                        onValueChange={(v) =>
                          void patchObject({ ...selected, rugTextureAssetId: v === "none" ? null : v })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {bundle.assets
                            .filter((a) => a.kind === "texture")
                            .map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Wall texture</Label>
                      <Select
                        value={selected.wallTextureAssetId ?? "none"}
                        onValueChange={(v) =>
                          void patchObject({ ...selected, wallTextureAssetId: v === "none" ? null : v })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {bundle.assets
                            .filter((a) => a.kind === "texture")
                            .map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">3D model</Label>
                      <Select
                        value={selected.modelAssetId ?? "none"}
                        onValueChange={(v) =>
                          void patchObject({
                            ...selected,
                            modelAssetId: v === "none" ? null : v,
                            appearance: v === "none" ? selected.appearance : "custom",
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {bundle.assets
                            .filter((a) => a.kind === "model")
                            .map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Select a booth or icon.</p>
            )}
          </div>
          <div className="p-3">
            <p className="chrome-kicker">Sponsors</p>
            <Input
              className="mt-2"
              value={sponsorQuery}
              onChange={(e) => setSponsorQuery(e.target.value)}
              placeholder="Search name or booth"
            />
          </div>
            <div className="space-y-1 px-3 pb-3">
              {filteredSponsors.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void bindSponsor(s)}
                  className="chrome-row px-2"
                >
                  {s.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logoUrl} alt="" className="h-6 w-6 bg-white object-contain p-0.5" />
                  ) : (
                    <span className="h-6 w-6 rounded bg-muted" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{s.boothNumber}</span>
                </button>
              ))}
              {!bundle.sponsors.length ? (
                <p className="text-xs text-muted-foreground">
                  Sync Airtable in Assets, or keep booths unbound.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
