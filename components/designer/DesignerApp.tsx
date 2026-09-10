"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { Box, Building2, CalendarDays, ChevronDown, Circle, ImagePlus, LayoutGrid, MapPin, Maximize2, Menu, Pentagon, Plus, Redo2, RefreshCw, Square, Theater, Type, Undo2 } from "lucide-react";
import { ObjectMediaFields } from "@/components/designer/ObjectMediaFields";
import { SponsorCombobox } from "@/components/designer/SponsorCombobox";
import { VenueLayersEditor } from "@/components/designer/VenueLayersEditor";
import { FloorCanvas } from "@/components/map/FloorCanvas";
import { FloorSwitcher, GridToggle, RulersToggle, ViewModeToggle } from "@/components/map/ViewModeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AMENITIES, amenityLabel } from "@/lib/amenities";
import { STAGE_PRESET_METERS, hallDefaults, resolveAppearance } from "@/lib/appearance";
import { displayLogoUrl } from "@/lib/hall";
import { DEFAULT_FLOOR_BASEMAP, BASEMAP_COORD_STEP, bearingSliderValue, roundBasemapCoord, wrapBearingDeg } from "@/lib/basemap";
import { withInheritedFloorSettings, inheritedSettingsTargetId } from "@/lib/floor-settings";
import { floorSizeMeters, metersFromPixels, ringBounds, scaleRingToSize } from "@/lib/geometry";
import { commitShape, objectShape, rotateBezier, translateBezier, type BezierNode } from "@/lib/bezier";
import { PRESETS, presetMeters as presetSize, formatArea, formatSize, fromMeters, toMeters } from "@/lib/units";
import { useUnits } from "@/lib/use-units";
import type {
  AmenityType,
  Appearance,
  DraftBundle,
  DraftSlice,
  DraftVersionMeta,
  Floor,
  FloorBasemap,
  LibraryAsset,
  MapObject,
  PinKind,
  Sponsor,
  Tool,
  Units,
  ViewMode,
} from "@/lib/types";
import { VENUE_ID, isPinObject, isMapPinObject, MAP_PIN_META } from "@/lib/types";
import {
  blankVenueSvg,
  deleteSvgLayer,
  findSvgLayer,
  isSvgUnderlay,
  listSvgLayers,
  reorderSvgSiblings,
  reparentSvgLayer,
  serializeSvg,
  setSvgElementPaint,
  setSvgElementOpacity,
  setSvgElementRotation,
  setSvgLayerHidden,
  setSvgLayerLocked,
  setSvgLayerPrivate,
  setSvgLayerName,
  setSvgLayerText,
  setSvgLayerFontSize,
  svgElementMetrics,
  svgElementPaint,
  svgElementRotation,
  svgViewBox,
  wrapRasterAsSvg,
  appendPastedSvg,
  clipboardLooksLikeSvg,
  pastedSvgPaths,
} from "@/lib/svg-layers";
import { newId, nowIso } from "@/lib/store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
type SponsorFilter = "all" | "placed" | "unplaced";
type SponsorSort = "tier" | "name" | "status";

const SPONSOR_FILTERS: { value: SponsorFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "placed", label: "Placed" },
  { value: "unplaced", label: "Not placed" },
];

const SPONSOR_SORT_LABEL: Record<SponsorSort, string> = {
  tier: "Tier",
  name: "Name",
  status: "Status",
};

const TIER_RANK = [
  "title",
  "strategic partners",
  "moon",
  "destination partner",
  "3 block",
  "2 block",
  "1 block",
];

function sponsorTierRank(tier: string): number {
  const t = tier.trim().toLowerCase();
  const i = TIER_RANK.findIndex((key) => t === key || t.endsWith(key) || t.includes(key));
  return i === -1 ? 1000 : i;
}

const OBJECT_FILTERS: {
  value: ObjectFilter;
  label: string;
  icon: typeof Square;
}[] = [
  { value: "all", label: "All", icon: LayoutGrid },
  { value: "stages", label: "Stages", icon: Theater },
  { value: "booths", label: "Booths", icon: Square },
  { value: "icons", label: "Icons", icon: MapPin },
];

const OBJECT_GROUP_ORDER = ["stages", "booths", "icons"] as const;
type ObjectListGroup = (typeof OBJECT_GROUP_ORDER)[number];
const OBJECT_GROUP_LABEL: Record<ObjectListGroup, string> = {
  stages: "Stages",
  booths: "Booths",
  icons: "Icons",
};

function isStage(o: MapObject): boolean {
  return /\bstage\b/i.test(`${o.name} ${o.boothNumber}`);
}

function isBooth(o: MapObject): boolean {
  return o.kind === "booth" && !isStage(o);
}

function objectListGroup(o: MapObject): ObjectListGroup {
  if (o.kind === "amenity") return "icons";
  if (isStage(o)) return "stages";
  return "booths";
}

function objectTitle(o: MapObject, sponsor?: Sponsor): string {
  return sponsor?.name || o.name || o.boothNumber || (isMapPinObject(o) ? MAP_PIN_META[o.kind].label : amenityLabel(o.amenityType ?? "info"));
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

function clipboardRasterFile(data: DataTransfer | null): File | null {
  if (!data) return null;
  const fromItems = [...data.items]
    .filter((item) => item.kind === "file" && item.type.startsWith("image/") && item.type !== "image/svg+xml")
    .map((item) => item.getAsFile())
    .find((file): file is File => Boolean(file));
  if (fromItems) return fromItems;
  return [...data.files].find((file) => file.type.startsWith("image/") && file.type !== "image/svg+xml") ?? null;
}

function svgNodesToWorld(nodes: BezierNode[], cal: NonNullable<Floor["calibration"]>, vb: { x: number; y: number; w: number; h: number }): BezierNode[] {
  const mapPt = (x: number, y: number) => {
    const px = vb.w > 0 ? ((x - vb.x) / vb.w) * cal.widthPx : x;
    const py = vb.h > 0 ? ((y - vb.y) / vb.h) * cal.heightPx : y;
    return metersFromPixels(px, py, cal);
  };
  return nodes.map((n) => {
    const p = mapPt(n.x, n.y);
    const hin = mapPt(n.x + n.inDx, n.y + n.inDy);
    const hout = mapPt(n.x + n.outDx, n.y + n.outDy);
    return {
      ...n,
      x: p.x,
      y: p.y,
      inDx: hin.x - p.x,
      inDy: hin.y - p.y,
      outDx: hout.x - p.x,
      outDy: hout.y - p.y,
    };
  });
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

function formatAbsoluteWhen(at: Date): string {
  return at.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatSavedWhen(at: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - at.getTime());
  if (ms >= DAY_MS) {
    return at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const sec = Math.floor(ms / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ago`;
}

function formatTimeAgo(at: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - at.getTime());
  const sec = Math.floor(ms / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function fmtDim(meters: number, units: Units): string {
  const v = fromMeters(meters, units);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
}

function parseDim(raw: string): number {
  return Number(raw.trim().replace(",", "."));
}

export function DesignerApp({ initial }: { initial: DraftBundle }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [bundle, setBundle] = useState(initial);
  const [floorId, setFloorId] = useState(initial.floors[0]?.id ?? "");
  const [tool, setTool] = useState<Tool>("select");
  const [viewMode, setViewMode] = useState<ViewMode>("plan");
  const [orthographic, setOrthographic] = useState(false);
  const [stampAppearance, setStampAppearance] = useState<Appearance | null>(null);
  const [stampModelId, setStampModelId] = useState<string | null>(null);
  const [units, setUnits] = useUnits();
  const [snapToObjects, setSnapToObjects] = useState(true);
  const [snapToUnits, setSnapToUnits] = useState(false);
  const [presetId, setPresetId] = useState<string>("none");
  const [amenityStamp, setAmenityStamp] = useState<AmenityType>("bathroom");
  const [pinKind, setPinKind] = useState<PinKind>("amenity");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds[0] ?? null;
  const [frameNonce, setFrameNonce] = useState(0);
  const [fitNonce, setFitNonce] = useState(0);
  const [sponsorQuery, setSponsorQuery] = useState("");
  const [sponsorFilter, setSponsorFilter] = useState<SponsorFilter>("all");
  const [sponsorSort, setSponsorSort] = useState<SponsorSort>("tier");
  const [sponsorSortDir, setSponsorSortDir] = useState<SortDir>("asc");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"objects" | "furniture" | "venue" | "map">("objects");
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
  const [publishedAt, setPublishedAt] = useState(initial.publication?.publishedAt ?? null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [saveLabel, setSaveLabel] = useState<"Saved" | "Saving…">("Saved");
  const [versions, setVersions] = useState<DraftVersionMeta[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [underlayOpacity, setUnderlayOpacity] = useState(1);
  const [showUnderlay, setShowUnderlay] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showRulers, setShowRulers] = useState(false);
  const [venueSvg, setVenueSvg] = useState<string | null>(null);
  const [hoverLayerId, setHoverLayerId] = useState<string | null>(null);
  const [selectedVenueEl, setSelectedVenueEl] = useState<string | null>(null);
  const [selectedVenueEls, setSelectedVenueEls] = useState<string[]>([]);
  const [venueStampHref, setVenueStampHref] = useState<string | null>(null);
  const [venueStampAspect, setVenueStampAspect] = useState(1);
  const venueImageInputRef = useRef<HTMLInputElement>(null);

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
    tool: "select" as Tool,
    viewMode: "plan" as ViewMode,
  });
  const deleteSelectedVertexRef = useRef<(() => boolean) | null>(null);
  const [hasSelectedVertex, setHasSelectedVertex] = useState(false);

  const floorsSorted = useMemo(
    () => [...bundle.floors].sort((a, b) => a.sortOrder - b.sortOrder),
    [bundle.floors],
  );
  const floorRecord = floorsSorted.find((f) => f.id === floorId) ?? floorsSorted[0];
  const floor = floorRecord ? withInheritedFloorSettings(floorRecord, floorsSorted) : undefined;
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
      if (isMapPinObject(o)) return false;
      if (objectFilter === "booths") return isBooth(o);
      if (objectFilter === "stages") return isStage(o);
      if (objectFilter === "icons") return o.kind === "amenity";
      return true;
    });
    return [...matches].sort((a, b) => {
      if (objectFilter === "all") {
        const groupCmp =
          OBJECT_GROUP_ORDER.indexOf(objectListGroup(a)) - OBJECT_GROUP_ORDER.indexOf(objectListGroup(b));
        if (groupCmp !== 0) return groupCmp;
      }
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

  const listedMapPins = useMemo(() => {
    return objects
      .filter(isMapPinObject)
      .sort((a, b) => objectTitle(a).localeCompare(objectTitle(b)));
  }, [objects]);

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

  venueEditRef.current = {
    el: selectedVenueEl,
    els: selectedVenueEls,
    svg: venueSvg,
    tab: sidebarTab,
    tool,
    viewMode,
  };

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

  useEffect(() => {
    const url = floor?.underlayUrl;
    if (!url) {
      setVenueSvg(null);
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

  useEffect(() => {
    const objects = localStorage.getItem("conference-maps-snap-objects");
    const grid = localStorage.getItem("conference-maps-snap-units");
    if (objects === "0") setSnapToObjects(false);
    if (objects === "1") setSnapToObjects(true);
    if (grid === "1") setSnapToUnits(true);
    if (grid === "0") setSnapToUnits(false);
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
    if (!floorRecord) return;
    const targetId = inheritedSettingsTargetId(floorRecord, bundleRef.current.floors, "basemap");
    const nextFloors = bundleRef.current.floors.map((f) => (f.id === targetId ? { ...f, basemap: next } : f));
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

  const placedBoothBySponsorId = useMemo(() => {
    const map = new Map<string, MapObject>();
    for (const o of bundle.objects) {
      if (o.sponsorId && !map.has(o.sponsorId)) map.set(o.sponsorId, o);
    }
    return map;
  }, [bundle.objects]);

  const filteredSponsors = useMemo(() => {
    const q = sponsorQuery.trim().toLowerCase();
    const list = bundle.sponsors.filter((s) => {
      const placed = placedBoothBySponsorId.has(s.id);
      if (sponsorFilter === "placed" && !placed) return false;
      if (sponsorFilter === "unplaced" && placed) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.boothNumber.toLowerCase().includes(q) ||
        s.tier.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sponsorSort === "status") {
        cmp = Number(placedBoothBySponsorId.has(a.id)) - Number(placedBoothBySponsorId.has(b.id));
      } else if (sponsorSort === "tier") {
        cmp = sponsorTierRank(a.tier) - sponsorTierRank(b.tier);
        if (!cmp) cmp = a.tier.localeCompare(b.tier, undefined, { sensitivity: "base" });
      }
      if (!cmp) cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return sponsorSortDir === "asc" ? cmp : -cmp;
    });
  }, [bundle.sponsors, sponsorQuery, sponsorFilter, sponsorSort, sponsorSortDir, placedBoothBySponsorId]);

  const hasSelection = selectedIds.length > 0 || Boolean(selectedVenueEl);

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
    if (isPinObject(selected)) {
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

  const createObjects = useCallback(async (objs: MapObject[]) => {
    if (!objs.length) return;
    markHistory();
    setSaveLabel("Saving…");
    setBundle((b) => ({ ...b, objects: [...b.objects, ...objs] }));
    setSelectedIds(objs.map((o) => o.id));
    if (!objs.some(isMapPinObject)) setSidebarTab("objects");
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
    if (deleteSelectedVertexRef.current?.()) return;
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
    setPresetId("none");
    setStampAppearance(null);
    setStampModelId(null);
    setTool(nextTool);
  }

  function beginVenueLabel() {
    beginVenueDraw("label");
  }

  async function onVenueImageFile(file: File | undefined) {
    if (!file) return;
    if (!ensureVenueDrawing()) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", "texture");
    fd.set("name", file.name.replace(/\.[^.]+$/, ""));
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${bundle.event.slug}/assets`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const asset = data as LibraryAsset;
      setBundle((b) => ({ ...b, assets: [...b.assets, asset] }));
      const aspect = await new Promise<number>((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve(img.naturalWidth / Math.max(1, img.naturalHeight));
        img.onerror = () => resolve(1);
        img.src = asset.url;
      });
      setVenueStampHref(asset.url);
      setVenueStampAspect(Number.isFinite(aspect) && aspect > 0 ? aspect : 1);
      beginVenueDraw("image");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (venueImageInputRef.current) venueImageInputRef.current.value = "";
    }
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

  async function syncSponsors() {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/events/${slug}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setBundle((b) => ({
        ...b,
        sponsors: data.sponsors ?? b.sponsors,
        event: { ...b.event, sponsorsSyncedAt: nowIso() },
      }));
      toast.success(`Synced ${data.sponsors?.length ?? 0} sponsors`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${bundle.event.slug}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      if (typeof data.publishedAt === "string") setPublishedAt(data.publishedAt);
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

  function focusPlacedSponsor(s: Sponsor) {
    const booth = placedBoothBySponsorId.get(s.id);
    if (!booth) return;
    if (booth.floorId !== floor?.id) setFloorId(booth.floorId);
    setSelectedIds([booth.id]);
    setTool("select");
    setFrameNonce((n) => n + 1);
  }

  async function deleteSelectedObjects() {
    const ids = selectedIds.filter((id) => id !== VENUE_ID);
    if (!ids.length) return;
    markHistory();
    setSaveLabel("Saving…");
    setBundle((b) => ({ ...b, objects: b.objects.filter((o) => !ids.includes(o.id)) }));
    setSelectedIds([]);
    await Promise.all(ids.map((id) => fetch(`/api/objects/${id}`, { method: "DELETE" })));
    markSaved();
  }

  async function deleteSelected() {
    if (deleteSelectedVertexRef.current?.()) return;
    await deleteSelectedObjects();
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

    function pasteSvgText(text: string): boolean {
      const venue = venueEditRef.current;
      const venueOk = venue.tab === "venue" && venue.viewMode === "plan";
      const objectsOk =
        venue.tab === "objects" &&
        venue.viewMode === "plan" &&
        (venue.tool === "select" || venue.tool === "rect" || venue.tool === "polygon");
      if (venueOk) {
        const host = ensureVenueDrawing();
        if (!host) return false;
        const imported = appendPastedSvg(host, text);
        if (!imported) return false;
        commitVenueSvg(imported.markup);
        setSelectedVenueEls(imported.ids);
        setSelectedVenueEl(imported.ids[0] ?? null);
        setTool("select");
        return true;
      }
      if (!objectsOk || !floor?.calibration) return false;
      const paths = pastedSvgPaths(text);
      if (!paths.length) return false;
      let vb = { x: 0, y: 0, w: floor.calibration.widthPx, h: floor.calibration.heightPx };
      if (venue.svg) {
        try {
          const next = svgViewBox(venue.svg);
          if (next) vb = next;
        } catch {
          /* keep calibration pixels */
        }
      }
      const t = nowIso();
      const copies = paths.map((parsed) => {
        const world = svgNodesToWorld(parsed.nodes, floor.calibration!, vb);
        const shape = commitShape(world, parsed.closed);
        return {
          id: newId(),
          floorId: floor.id,
          kind: "booth" as const,
          polygon: shape.polygon,
          path: shape.path,
          x: null,
          y: null,
          rotation: 0,
          boothNumber: "",
          name: "",
          sponsorId: null,
          amenityType: null,
          color: null,
          description: "",
          eventDate: "",
          ...hallDefaults({ appearance: stampAppearance, modelAssetId: stampModelId }),
          createdAt: t,
          updatedAt: t,
        };
      });
      void createObjects(copies);
      setTool("select");
      return true;
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
      if (sources?.length) {
        e.preventDefault();
        pasteObjects(sources);
        return;
      }

      const venue = venueEditRef.current;
      const svgFromEvent =
        e.clipboardData?.getData("image/svg+xml") ||
        e.clipboardData?.getData("text/html") ||
        "";
      const svgText = clipboardLooksLikeSvg(text)
        ? text
        : clipboardLooksLikeSvg(svgFromEvent)
          ? svgFromEvent
          : "";
      const svgItem = [...(e.clipboardData?.items ?? [])].find((item) => item.type === "image/svg+xml");
      const venueOk = venue.tab === "venue" && venue.viewMode === "plan";
      const objectsShapeOk =
        venue.tab === "objects" &&
        venue.viewMode === "plan" &&
        (venue.tool === "select" || venue.tool === "rect" || venue.tool === "polygon");

      if (svgItem && (venueOk || objectsShapeOk)) {
        e.preventDefault();
        const raster = clipboardRasterFile(e.clipboardData);
        svgItem.getAsString((value) => {
          if (!pasteSvgText(value) && venueOk && raster) void onVenueImageFile(raster);
        });
        return;
      }

      if (svgText && (venueOk || objectsShapeOk) && pasteSvgText(svgText)) {
        e.preventDefault();
        return;
      }

      const raster = clipboardRasterFile(e.clipboardData);
      if (raster && venueOk) {
        e.preventDefault();
        void onVenueImageFile(raster);
      }
    }

    function onCut(e: ClipboardEvent) {
      if (isTypingTarget(e.target) || inPalette(e.target)) return;
      if (!copySelected(e)) return;
      void deleteSelectedObjects();
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
      if (e.key === "e" || e.key === "E") {
        if (sidebarTab === "venue") {
          beginVenueDraw("ellipse");
          return;
        }
      }
      if ((e.key === "l" || e.key === "L") && sidebarTab === "venue") {
        beginVenueLabel();
        return;
      }
      if (e.key === "i" || e.key === "I") {
        setSidebarTab("objects");
        setPinKind("amenity");
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
      <header className="grid h-10 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-sidebar-border bg-sidebar px-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Button size="icon-sm" variant="ghost" asChild>
            <Link href="/events" aria-label="All events" title="All events">
              <Menu strokeWidth={1.5} />
            </Link>
          </Button>
          <h1 className="min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex max-w-full items-center gap-1 truncate rounded-lg px-1.5 py-1 text-[13px] font-medium hover:bg-muted"
                >
                  <span className="truncate">{bundle.event.name}</span>
                  <ChevronDown className="size-4 shrink-0 opacity-60" strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-40">
                {(
                  [
                    ["Designer", `/e/${bundle.event.slug}/edit`],
                    ["Assets", `/e/${bundle.event.slug}/assets`],
                    ["Sponsors", `/e/${bundle.event.slug}/assets/sponsors`],
                    ["Agenda", `/e/${bundle.event.slug}/assets/agenda`],
                    ["Library", `/e/${bundle.event.slug}/assets/library`],
                    ["Settings", `/e/${bundle.event.slug}/settings`],
                  ] as const
                ).map(([label, href]) => (
                  <DropdownMenuItem key={href} onSelect={() => router.push(href)}>
                    {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Units</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={units}
                  onValueChange={(value) => setUnits(value as "m" | "ft")}
                >
                  <DropdownMenuRadioItem value="m" onSelect={(e) => e.preventDefault()}>
                    Metres
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="ft" onSelect={(e) => e.preventDefault()}>
                    Feet
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Snap</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={snapToObjects}
                  onCheckedChange={(checked) => {
                    const next = checked === true;
                    setSnapToObjects(next);
                    localStorage.setItem("conference-maps-snap-objects", next ? "1" : "0");
                  }}
                  onSelect={(e) => e.preventDefault()}
                >
                  Snap to objects
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={snapToUnits}
                  onCheckedChange={(checked) => {
                    const next = checked === true;
                    setSnapToUnits(next);
                    localStorage.setItem("conference-maps-snap-units", next ? "1" : "0");
                  }}
                  onSelect={(e) => e.preventDefault()}
                >
                  {units === "ft" ? "Snap to whole feet" : "Snap to whole metres"}
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={resolvedTheme === "light" ? "light" : "dark"}
                  onValueChange={(value) => setTheme(value)}
                >
                  <DropdownMenuRadioItem value="light" onSelect={(e) => e.preventDefault()}>
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark" onSelect={(e) => e.preventDefault()}>
                    Dark
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center">
            <Button
              size="icon-sm"
              variant="ghost"
              title="Fit drawing and objects (0)"
              onClick={() => setFitNonce((n) => n + 1)}
            >
              <Maximize2 strokeWidth={1.5} />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              title="Undo"
              disabled={!canUndo || busy}
              onClick={() => void undo()}
            >
              <Undo2 strokeWidth={1.5} />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              title="Redo"
              disabled={!canRedo || busy}
              onClick={() => void redo()}
            >
              <Redo2 strokeWidth={1.5} />
            </Button>
          </div>
          <span className="h-5 w-px bg-border" aria-hidden />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                title="Versions"
                className="h-8 min-w-0 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {saveLabel === "Saving…"
                  ? "Saving…"
                  : lastSavedAt
                    ? `Saved ${formatSavedWhen(lastSavedAt, new Date(nowTick))}`
                    : "Saved"}
                <ChevronDown className="size-4 opacity-60" strokeWidth={1.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="min-w-56">
              <DropdownMenuLabel>Versions</DropdownMenuLabel>
              {versions.length ? (
                versions.map((v) => (
                  <DropdownMenuItem key={v.id} onClick={() => void restoreVersion(v.id)}>
                    {formatAbsoluteWhen(new Date(v.createdAt))}
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
          <span className="h-5 w-px bg-border" aria-hidden />
          <div className="flex items-center">
            <GridToggle value={showGrid} onChange={setShowGrid} />
            <RulersToggle value={showRulers} onChange={setShowRulers} />
          </div>
          <span className="h-5 w-px bg-border" aria-hidden />
          <ViewModeToggle
            value={viewMode}
            onChange={(mode) => {
              setViewMode(mode);
              if (mode === "hall" && (tool === "calibrate" || tool === "label" || tool === "image" || tool === "ellipse")) setTool("select");
            }}
            orthographic={orthographic}
            onOrthographicChange={setOrthographic}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <div className="group relative">
            <Button size="sm" onClick={() => void publish()} disabled={busy}>
              Publish
            </Button>
            <div className="invisible absolute right-0 top-full z-50 pt-1 opacity-0 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="min-w-52 rounded-lg bg-popover p-2 text-sm shadow-md ring-1 ring-foreground/10">
                <p
                  className="px-1.5 pb-1.5 text-[11px] leading-snug text-muted-foreground"
                  suppressHydrationWarning
                >
                  {publishedAt
                    ? `Last published ${formatSavedWhen(new Date(publishedAt), new Date(nowTick))} · ${formatAbsoluteWhen(new Date(publishedAt))}`
                    : "Not published yet"}
                </p>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link href={viewerUrl} target="_blank">
                    Viewer
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[260px] min-h-0 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar md:flex">
          <div className="flex gap-0.5 border-b border-border p-1.5">
            {(
              [
                ["objects", "POIs"],
                ["furniture", "Furniture"],
                ["venue", "Venue"],
                ["map", "Map"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`h-8 flex-1 rounded-md px-2 text-[11px] font-medium ${
                  sidebarTab === id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  setSidebarTab(id);
                  if (id === "venue") {
                    setSelectedIds([VENUE_ID]);
                    setTool("select");
                    setPresetId("none");
                  } else if (id === "map") {
                    if (selectedId === VENUE_ID) setSelectedIds([]);
                    if (tool === "calibrate" || tool === "rect" || tool === "ellipse" || tool === "polygon" || tool === "label" || tool === "image") setTool("select");
                    if (tool === "icon" && pinKind === "amenity") setTool("select");
                  } else if (id === "furniture") {
                    if (selectedId === VENUE_ID) setSelectedIds([]);
                    if (tool === "calibrate" || tool === "rect" || tool === "ellipse" || tool === "polygon" || tool === "label" || tool === "image") setTool("select");
                    if (tool === "icon") setTool("select");
                  } else {
                    if (selectedId === VENUE_ID) setSelectedIds([]);
                    if (tool === "calibrate") setTool("select");
                    if (tool === "icon" && pinKind !== "amenity") setTool("select");
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
                  Booths and icons. Switch to Venue to edit the drawing.
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
                      <Plus strokeWidth={1.5} />
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
                      <Square strokeWidth={1.5} />
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
                      <Pentagon strokeWidth={1.5} />
                      Polygon
                      <DropdownMenuShortcut>P</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <MapPin strokeWidth={1.5} />
                        Icon
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {AMENITIES.map((a) => (
                          <DropdownMenuItem
                            key={a.type}
                            onClick={() => {
                              setStampAppearance(null);
                              setStampModelId(null);
                              setPinKind("amenity");
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
                        <Box strokeWidth={1.5} />
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
                {tool === "icon" && pinKind === "amenity" ? (
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
                          className={`flex size-8 items-center justify-center rounded-md transition-colors ${
                            active
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                          }`}
                        >
                          <Icon className="size-4 shrink-0" strokeWidth={1.5} />
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
                          className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                        >
                          <ChevronDown
                            className={`size-4 shrink-0 ${objectSortDir === "desc" ? "rotate-180" : ""}`}
                            strokeWidth={1.5}
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
                  {listedObjects.map((o, i) => {
                    const s = o.sponsorId
                      ? bundle.sponsors.find((sp) => sp.id === o.sponsorId)
                      : undefined;
                    const title = objectTitle(o, s);
                    const logoUrl = displayLogoUrl(o, bundle.assets, s);
                    const group = objectListGroup(o);
                    const showGroup =
                      objectFilter === "all" &&
                      (i === 0 || objectListGroup(listedObjects[i - 1]) !== group);
                    const sub =
                      o.kind === "amenity"
                        ? "Icon"
                        : o.polygon
                          ? formatSize(ringBounds(o.polygon).w, ringBounds(o.polygon).h, units)
                          : isStage(o)
                            ? "Stage"
                            : "Booth";
                    return (
                      <Fragment key={o.id}>
                        {showGroup ? (
                          <p className="px-3 pt-2 pb-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                            {OBJECT_GROUP_LABEL[group]}
                          </p>
                        ) : null}
                        <button
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
                          {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt="" className="h-6 w-6 bg-white object-contain p-0.5" />
                          ) : null}
                          <span className="min-w-0 flex-1 truncate">{title}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{sub}</span>
                        </button>
                      </Fragment>
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
          ) : sidebarTab === "furniture" ? (
            <div className="min-h-0 flex-1 overflow-auto p-3">
              <p className="text-xs text-muted-foreground">Coming soon.</p>
            </div>
          ) : sidebarTab === "map" ? (
            <div className="min-h-0 flex-1 overflow-auto p-3">
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
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">
                    Place side events and hotels on the city map.
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        className="w-full"
                        variant={tool === "icon" && pinKind !== "amenity" ? "default" : "outline"}
                      >
                        <Plus strokeWidth={1.5} />
                        Add pin
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-52">
                      <DropdownMenuItem
                        onClick={() => {
                          setViewMode("plan");
                          setAlignDrawingToMap(false);
                          setPinKind("side_event");
                          setTool("icon");
                        }}
                      >
                        <CalendarDays strokeWidth={1.5} />
                        Side event
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setViewMode("plan");
                          setAlignDrawingToMap(false);
                          setPinKind("hotel");
                          setTool("icon");
                        }}
                      >
                        <Building2 strokeWidth={1.5} />
                        Hotel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {tool === "icon" && pinKind !== "amenity" ? (
                    <p className="text-[11px] text-primary">
                      Click the map to place a {MAP_PIN_META[pinKind].label.toLowerCase()}. Esc cancels.
                    </p>
                  ) : null}
                  <p className="chrome-kicker">Pins</p>
                  <div>
                    {listedMapPins.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        data-active={selectedIds.includes(o.id)}
                        onClick={() => {
                          setSelectedIds([o.id]);
                          setTool("select");
                        }}
                        className="chrome-row"
                      >
                        <span
                          className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: MAP_PIN_META[o.kind].color }}
                        >
                          {MAP_PIN_META[o.kind].mark}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{objectTitle(o)}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {MAP_PIN_META[o.kind].label}
                        </span>
                      </button>
                    ))}
                    {!listedMapPins.length ? (
                      <p className="px-1 py-3 text-xs text-muted-foreground">No side events or hotels yet.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-0 overflow-auto p-3">
              <div className="space-y-3">
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
                </div>

                {floorsSorted.length > 1 ? (
                  <FloorSwitcher
                    floors={floorsSorted}
                    value={floor?.id ?? ""}
                    onChange={(id) => {
                      setFloorId(id);
                      setSelectedIds([]);
                    }}
                  />
                ) : null}

                {floor ? (
                  <div>
                    <Label className="chrome-kicker">Level name</Label>
                    <Input
                      key={floor.id}
                      className="mt-1"
                      defaultValue={floor.name}
                      placeholder={`Level ${Math.max(1, floorsSorted.findIndex((f) => f.id === floor.id) + 1)}`}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== floor.name) void renameFloor(floor.id, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                    />
                  </div>
                ) : null}

                <div>
                  <Label className="chrome-kicker">Drawing layers</Label>
                  <input
                    ref={venueImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => void onVenueImageFile(e.target.files?.[0])}
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant={tool === "rect" ? "default" : "outline"}
                          aria-label="Rect"
                          onClick={() => beginVenueDraw("rect")}
                        >
                          <Square strokeWidth={1.5} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Rect</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant={tool === "ellipse" ? "default" : "outline"}
                          aria-label="Ellipse"
                          onClick={() => beginVenueDraw("ellipse")}
                        >
                          <Circle strokeWidth={1.5} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Ellipse</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant={tool === "polygon" ? "default" : "outline"}
                          aria-label="Polygon"
                          onClick={() => beginVenueDraw("polygon")}
                        >
                          <Pentagon strokeWidth={1.5} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Polygon</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant={tool === "label" ? "default" : "outline"}
                          aria-label="Label"
                          onClick={() => beginVenueLabel()}
                        >
                          <Type strokeWidth={1.5} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Label</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon-sm"
                          variant={tool === "image" ? "default" : "outline"}
                          aria-label="Image"
                          onClick={() => {
                            if (!ensureVenueDrawing()) return;
                            if (tool === "image" || !venueStampHref) venueImageInputRef.current?.click();
                            else beginVenueDraw("image");
                          }}
                        >
                          <ImagePlus strokeWidth={1.5} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Image</TooltipContent>
                    </Tooltip>
                  </div>
                  <VenueLayersEditor
                    layers={(() => {
                      if (!venueSvg) return [];
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
                    onToggleHidden={(id, hidden) => {
                      if (venueSvg) commitVenueSvg(setSvgLayerHidden(venueSvg, id, hidden));
                    }}
                    onToggleLocked={(id, locked) => {
                      if (venueSvg) commitVenueSvg(setSvgLayerLocked(venueSvg, id, locked));
                    }}
                    onTogglePrivate={(id, nextPrivate) => {
                      if (venueSvg) commitVenueSvg(setSvgLayerPrivate(venueSvg, id, nextPrivate));
                    }}
                    onDelete={(id) => {
                      if (venueSvg) commitVenueSvg(deleteSvgLayer(venueSvg, id));
                      setSelectedVenueEls((prev) => {
                        const next = prev.filter((x) => x !== id);
                        setSelectedVenueEl(next[next.length - 1] ?? null);
                        return next;
                      });
                    }}
                    onReorder={(parentId, ids) => {
                      if (venueSvg) commitVenueSvg(reorderSvgSiblings(venueSvg, parentId, ids));
                    }}
                    onReparent={(id, newParentId, beforeId) => {
                      if (venueSvg) commitVenueSvg(reparentSvgLayer(venueSvg, id, newParentId, beforeId));
                    }}
                    onRename={(id, name) => {
                      if (venueSvg) commitVenueSvg(setSvgLayerName(venueSvg, id, name));
                    }}
                    onRenameText={(id, text) => {
                      if (venueSvg) commitVenueSvg(setSvgLayerText(venueSvg, id, text));
                    }}
                    onOpacity={(id, opacity) => {
                      if (venueSvg) commitVenueSvg(setSvgElementOpacity(venueSvg, id, opacity));
                    }}
                  />
                </div>
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
                pinKind={pinKind}
                presetMeters={presetId && presetId !== "none" ? preset : null}
                stampAppearance={stampAppearance}
                stampModelAssetId={stampModelId}
                showGrid={showGrid}
                showRulers={showRulers}
                orthographic={orthographic}
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
                pinKind={pinKind}
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
                  if (isMapPinObject(o)) return;
                  setTool("select");
                  setPresetId("none");
                  setStampAppearance(null);
                  setStampModelId(null);
                }}
                underlayOpacity={underlayOpacity}
                showGrid={showGrid}
                showRulers={showRulers}
                snapToObjects={snapToObjects}
                snapToUnits={snapToUnits}
                underlaySvg={venueSvg}
                showUnderlay={showUnderlay}
                underlayHoverLayerId={sidebarTab === "venue" ? hoverLayerId : null}
                editVenueElements={sidebarTab === "venue"}
                selectedVenueElementId={sidebarTab === "venue" ? selectedVenueEl : null}
                selectedVenueElementIds={sidebarTab === "venue" ? selectedVenueEls : []}
                onHoverVenueElement={setHoverLayerId}
                onSelectVenueElement={(id, additive) => selectVenueLayer(id, additive)}
                onPreviewVenueSvg={setVenueSvg}
                onCommitVenueSvg={(svg) => commitVenueSvg(svg)}
                venueStampHref={venueStampHref}
                venueStampAspect={venueStampAspect}
                onToolChange={setTool}
                deleteSelectedVertexRef={deleteSelectedVertexRef}
                onSelectedVertexChange={setHasSelectedVertex}
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
                }}
              />
            </div>
          </div>
          {sidebarTab === "venue" && (tool === "rect" || tool === "ellipse" || tool === "polygon") ? (
            <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-md border border-primary/40 bg-background/80 px-3 py-1.5 text-xs text-foreground">
              {tool === "polygon"
                ? "Click to add a corner; click-drag for curves. Enter closes. Hold Space to pan."
                : tool === "ellipse"
                  ? "Drag an ellipse on the venue. Hold Shift for a circle. Hold Space to pan."
                  : "Drag a rectangle on the venue. Hold Space to pan."}
            </div>
          ) : null}
        </main>

        <aside className="hidden w-[260px] min-w-0 min-h-0 shrink-0 flex-col overflow-hidden border-l border-sidebar-border bg-sidebar lg:flex">
          <ScrollArea className="min-h-0 min-w-0 w-full flex-1">
          <div className="w-full min-w-0 max-w-full overflow-x-hidden border-b border-border p-3">
            <p className="chrome-kicker">Inspector</p>
            {selectedVenueLayer && venueSvg ? (
              <div className="mt-2 min-w-0 space-y-2">
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
                {selectedVenueLayer.fontSize != null ? (
                  <div>
                    <Label htmlFor="insp-venue-type" className="text-[10px] text-muted-foreground">
                      Type size
                    </Label>
                    <Input
                      id="insp-venue-type"
                      type="number"
                      min="1"
                      step="any"
                      value={selectedVenueLayer.fontSize}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isFinite(n) || n <= 0) return;
                        commitVenueSvg(setSvgLayerFontSize(venueSvg, selectedVenueLayer.id, n));
                      }}
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
                  <Label htmlFor="insp-venue-opacity" className="text-[10px] text-muted-foreground">
                    Opacity
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      id="insp-venue-opacity"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={selectedVenueLayer.opacity}
                      onChange={(e) =>
                        commitVenueSvg(
                          setSvgElementOpacity(venueSvg, selectedVenueLayer.id, Number(e.target.value)),
                        )
                      }
                      className="w-full accent-primary"
                    />
                    <span className="w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                      {Math.round(selectedVenueLayer.opacity * 100)}%
                    </span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="insp-venue-rot" className="text-[10px] text-muted-foreground" title="Drag the top handle to rotate. Shift snaps to 15°.">
                    Rotation
                  </Label>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                    <Input
                      id="insp-venue-rot"
                      type="number"
                      step="any"
                      className="min-w-0 flex-1"
                      value={Number(svgElementRotation(venueSvg, selectedVenueLayer.id).toFixed(2))}
                      onChange={(e) => {
                        const deg = Number(e.target.value);
                        if (!Number.isFinite(deg)) return;
                        commitVenueSvg(setSvgElementRotation(venueSvg, selectedVenueLayer.id, deg));
                      }}
                    />
                    <span className="shrink-0 text-[10px] text-muted-foreground">°</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 px-2"
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
                      −45
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 px-2"
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
                      +45
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
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={selectedVenueLayer.private}
                    onChange={(e) =>
                      commitVenueSvg(setSvgLayerPrivate(venueSvg, selectedVenueLayer.id, e.target.checked))
                    }
                  />
                  Reference only (hidden on the published map)
                </label>
                <p className="text-xs text-muted-foreground">
                  Double-click a point to add or remove Bézier handles. Delete or Backspace removes the selected point, or the
                  element if none is selected. Hold Shift while rotating to snap to 15°.
                </p>
                <Button size="sm" variant="destructive" onClick={deleteSelectedVenueElement}>
                  {hasSelectedVertex ? "Delete point" : "Delete"}
                </Button>
              </div>
            ) : multiSelected ? (
              <div className="mt-2 min-w-0 space-y-2">
                <p className="text-sm font-medium">{selectedIds.filter((id) => id !== VENUE_ID).length} objects selected</p>
                <p className="text-xs text-muted-foreground">
                  Drag to move the group. Shift-click or shift-drag to add. Delete removes all.
                </p>
                <Button size="sm" variant="destructive" onClick={() => void deleteSelected()}>
                  Delete
                </Button>
              </div>
            ) : venueSelected && floor?.calibration ? (
              <div className="mt-2 min-w-0 space-y-2">
                <p className="text-sm font-medium">Venue drawing</p>
                <p className="text-xs text-muted-foreground">
                  Hold Space and drag to pan. Drag orange handles to stretch. Shift-drag the hall to slide the drawing.
                </p>
              </div>
            ) : selected ? (
              <div className="mt-2 min-w-0 space-y-2">
                <div>
                  <Label htmlFor="insp-label" className="text-[10px] text-muted-foreground">
                    {isMapPinObject(selected) ? "Title" : "Label"}
                  </Label>
                  <Input
                    id="insp-label"
                    value={selected.name}
                    onChange={(e) => void patchObject({ ...selected, name: e.target.value })}
                    placeholder={isMapPinObject(selected) ? MAP_PIN_META[selected.kind].label : "Display name"}
                  />
                </div>
                {isMapPinObject(selected) ? (
                  <>
                    {selected.kind === "side_event" ? (
                      <div>
                        <Label htmlFor="insp-event-date" className="text-[10px] text-muted-foreground">
                          Date
                        </Label>
                        <Input
                          id="insp-event-date"
                          type="date"
                          value={selected.eventDate}
                          onChange={(e) => void patchObject({ ...selected, eventDate: e.target.value })}
                        />
                      </div>
                    ) : null}
                    <div>
                      <Label htmlFor="insp-event-desc" className="text-[10px] text-muted-foreground">
                        {selected.kind === "hotel" ? "Address / notes" : "Description"}
                      </Label>
                      <Textarea
                        id="insp-event-desc"
                        value={selected.description}
                        onChange={(e) => void patchObject({ ...selected, description: e.target.value })}
                        placeholder={selected.kind === "hotel" ? "Hotel name, address" : "What happens here"}
                        className="mt-1 min-h-24 text-sm"
                      />
                    </div>
                    <ObjectMediaFields
                      slug={slug}
                      object={selected}
                      assets={bundle.assets}
                      imageOnly
                      onPatch={(o) => void patchObject(o)}
                      onAsset={(asset) =>
                        setBundle((b) => ({
                          ...b,
                          assets: b.assets.some((a) => a.id === asset.id) ? b.assets : [...b.assets, asset],
                        }))
                      }
                    />
                  </>
                ) : null}
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
                    <p className="text-[10px] text-muted-foreground">
                      Area{" "}
                      <span className="tabular-nums text-foreground">
                        {formatArea(
                          ringBounds(selected.polygon).w * ringBounds(selected.polygon).h,
                          units,
                          2,
                        )}
                      </span>
                    </p>
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
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                    <Label htmlFor="insp-object-rot" className="text-[10px] text-muted-foreground" title="Drag the top handle on the plan. Shift snaps to 15°.">
                      Rotation
                    </Label>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                      <Input
                        id="insp-object-rot"
                        type="number"
                        step="any"
                        className="min-w-0 flex-1"
                        value={Number(((isPinObject(selected) ? selected.rotation : selected.facingDeg) ?? 0).toFixed(2))}
                        onChange={(e) => applyObjectRotation(Number(e.target.value))}
                      />
                      <span className="shrink-0 text-[10px] text-muted-foreground">°</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 px-2"
                        onClick={() => applyObjectRotation(((isPinObject(selected) ? selected.rotation : selected.facingDeg) ?? 0) - 45)}
                      >
                        −45
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 px-2"
                        onClick={() => applyObjectRotation(((isPinObject(selected) ? selected.rotation : selected.facingDeg) ?? 0) + 45)}
                      >
                        +45
                      </Button>
                    </div>
                  </div>
                ) : null}
                {selected.polygon ? (
                  <p className="text-xs text-muted-foreground">
                    Double-click a point to add or remove Bézier handles. Delete removes the selected point, or the object if none is
                    selected.
                  </p>
                ) : null}
                <Button size="sm" variant="destructive" onClick={() => void deleteSelected()}>
                  {hasSelectedVertex ? "Delete point" : "Delete"}
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
                        <SelectTrigger className="mt-1 w-full min-w-0">
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
                        <SelectTrigger className="mt-1 w-full min-w-0">
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
                        <SelectTrigger className="mt-1 w-full min-w-0">
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
                        <SelectTrigger className="mt-1 w-full min-w-0">
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
          {!hasSelection ? (
            <>
              <div className="w-full min-w-0 max-w-full overflow-x-hidden p-3">
                <div className="flex min-w-0 items-center gap-1">
                  <p className="chrome-kicker">Sponsors</p>
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={() => void syncSponsors()}
                    title="Sync sponsors from Airtable"
                    aria-label="Sync Airtable sponsors"
                    className="ml-auto flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`size-3.5 shrink-0 ${syncing ? "animate-spin" : ""}`}
                      strokeWidth={1.5}
                    />
                    <span className="truncate">
                      {syncing
                        ? "Syncing…"
                        : bundle.event.sponsorsSyncedAt
                          ? `Synced ${formatTimeAgo(new Date(bundle.event.sponsorsSyncedAt), new Date(nowTick))}`
                          : "Never synced"}
                    </span>
                  </button>
                </div>
                <Input
                  className="mt-2"
                  value={sponsorQuery}
                  onChange={(e) => setSponsorQuery(e.target.value)}
                  placeholder="Search name or booth"
                />
                <div className="mt-2 flex min-w-0 items-center gap-0.5">
                  {SPONSOR_FILTERS.map((f) => {
                    const active = sponsorFilter === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSponsorFilter(f.value)}
                        className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                          active
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Sort sponsors"
                        className="ml-auto flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        {SPONSOR_SORT_LABEL[sponsorSort]}
                        <ChevronDown
                          className={`size-3 shrink-0 ${sponsorSortDir === "desc" ? "rotate-180" : ""}`}
                          strokeWidth={1.5}
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-36">
                      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={sponsorSort}
                        onValueChange={(v) => setSponsorSort(v as SponsorSort)}
                      >
                        <DropdownMenuRadioItem value="tier">Tier</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="status">Status</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={sponsorSortDir}
                        onValueChange={(v) => setSponsorSortDir(v as SortDir)}
                      >
                        <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="min-w-0 space-y-1 px-3 pb-3">
                {filteredSponsors.map((s) => {
                  const booth = placedBoothBySponsorId.get(s.id);
                  const placed = Boolean(booth);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => focusPlacedSponsor(s)}
                      className="chrome-row chrome-row-align"
                    >
                      {s.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logoUrl} alt="" className="h-6 w-6 bg-white object-contain p-0.5" />
                      ) : (
                        <span className="h-6 w-6 rounded bg-muted" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span
                        className={`shrink-0 text-[10px] ${
                          placed ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {placed ? "Placed" : "Not placed"}
                      </span>
                    </button>
                  );
                })}
                {!bundle.sponsors.length ? (
                  <p className="text-xs text-muted-foreground">
                    Sync Airtable in Assets, or keep booths unbound.
                  </p>
                ) : !filteredSponsors.length ? (
                  <p className="text-xs text-muted-foreground">
                    {sponsorQuery.trim()
                      ? `No sponsors matching “${sponsorQuery.trim()}”.`
                      : sponsorFilter === "placed"
                        ? "No placed sponsors."
                        : "No unplaced sponsors."}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
