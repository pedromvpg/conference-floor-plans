"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutGrid, MapPin, Maximize2, Pentagon, Plus, Redo2, Settings, Square, Theater, Undo2 } from "lucide-react";
import { FloorCanvas } from "@/components/map/FloorCanvas";
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
import { calibrationFromBounds, floorSizeMeters, ringBounds, rotateRing, scaleRingToSize } from "@/lib/geometry";
import { PRESETS, presetMeters as presetSize, formatSize, fromMeters, toMeters } from "@/lib/units";
import { useUnits } from "@/lib/use-units";
import type {
  AmenityType,
  Calibration,
  DraftBundle,
  DraftSlice,
  DraftVersionMeta,
  Floor,
  MapObject,
  Sponsor,
  Tool,
  Units,
} from "@/lib/types";
import { VENUE_ID } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

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
  const [units] = useUnits();
  const [presetId, setPresetId] = useState<string>("none");
  const [amenityStamp, setAmenityStamp] = useState<AmenityType>("bathroom");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frameNonce, setFrameNonce] = useState(0);
  const [fitNonce, setFitNonce] = useState(0);
  const [sponsorQuery, setSponsorQuery] = useState("");
  const [newFloorName, setNewFloorName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"objects" | "venue">("objects");
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

  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;
  const pastRef = useRef<DraftSlice[]>([]);
  const futureRef = useRef<DraftSlice[]>([]);
  const coalesceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const floor = bundle.floors.find((f) => f.id === floorId) ?? bundle.floors[0];
  const objects = bundle.objects.filter((o) => o.floorId === floor?.id);
  const selected = objects.find((o) => o.id === selectedId) ?? null;
  const venueSelected = selectedId === VENUE_ID;
  const preset = presetId ? presetSize(presetId) : null;
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

  const slug = bundle.event.slug;

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
    if (!selected?.polygon) {
      setBoothWidth("");
      setBoothHeight("");
      return;
    }
    const b = ringBounds(selected.polygon);
    setBoothWidth(fmtDim(b.w, units));
    setBoothHeight(fmtDim(b.h, units));
  }, [selected?.id, selected?.polygon, units]);

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

  async function undo() {
    if (coalesceRef.current) {
      clearTimeout(coalesceRef.current);
      coalesceRef.current = null;
    }
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current = [...futureRef.current, cloneSlice()].slice(-80);
    syncUndoFlags();
    setSelectedId(null);
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
    setSelectedId(null);
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
    setSelectedId(null);
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

  function onVenueWidthChange(v: string) {
    setVenueWidth(v);
  }

  function onVenueHeightChange(v: string) {
    setVenueHeight(v);
  }

  const createObject = useCallback(async (obj: MapObject) => {
    markHistory();
    setSaveLabel("Saving…");
    setBundle((b) => ({ ...b, objects: [...b.objects, obj] }));
    setSelectedId(obj.id);
    await fetch("/api/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });
    markSaved();
  }, [snapshotVersion]);

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

  async function uploadUnderlay(file: File) {
    if (!floor) return;
    markHistory();
    setBusy(true);
    setSaveLabel("Saving…");
    try {
      const ready = await rasterizeIfPdf(file);
      const fd = new FormData();
      fd.set("file", ready);
      const res = await fetch(`/api/floors/${floor.id}/underlay`, { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as Floor;
      setBundle((b) => ({
        ...b,
        floors: b.floors.map((f) => (f.id === updated.id ? updated : f)),
      }));
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

  async function addFloor() {
    const name = newFloorName.trim() || `Level ${bundle.floors.length + 1}`;
    markHistory();
    setSaveLabel("Saving…");
    const res = await fetch(`/api/events/${bundle.event.slug}/floors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      toast.error("Could not add floor");
      return;
    }
    const floorRow = (await res.json()) as Floor;
    setBundle((b) => ({ ...b, floors: [...b.floors, floorRow] }));
    setFloorId(floorRow.id);
    setNewFloorName("");
    markSaved();
  }

  async function syncAirtable() {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${bundle.event.slug}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setBundle((b) => ({ ...b, sponsors: data.sponsors as Sponsor[] }));
      toast.success(`Synced ${data.sponsors.length} sponsors`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
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

  async function bindSponsor(s: Sponsor) {
    if (!selected || selected.kind !== "booth") return;
    await patchObject({
      ...selected,
      sponsorId: s.id,
      name: selected.name || s.name,
      boothNumber: selected.boothNumber || s.boothNumber,
    });
  }

  async function deleteSelected() {
    if (!selected) return;
    markHistory();
    setSaveLabel("Saving…");
    setBundle((b) => ({ ...b, objects: b.objects.filter((o) => o.id !== selected.id) }));
    setSelectedId(null);
    await fetch(`/api/objects/${selected.id}`, { method: "DELETE" });
    markSaved();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) void redo();
        else void undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        void redo();
        return;
      }
      if (e.key === "Escape") {
        setTool("select");
        setPresetId("none");
      }
      if (e.key === "0") {
        setFitNonce((n) => n + 1);
      }
      if (e.key === "v" || e.key === "V") {
        setSidebarTab("objects");
        if (selectedId === VENUE_ID) setSelectedId(null);
        setTool("select");
      }
      if (e.key === "r" || e.key === "R") {
        setSidebarTab("objects");
        setPresetId("none");
        setTool("rect");
      }
      if (e.key === "p" || e.key === "P") {
        setSidebarTab("objects");
        setTool("polygon");
      }
      if (e.key === "i" || e.key === "I") {
        setSidebarTab("objects");
        setTool("icon");
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (sidebarTab === "objects") void deleteSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button size="sm" variant="outline" onClick={() => void syncAirtable()} disabled={busy}>
            Sync sponsors
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
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border bg-background md:flex">
          <div className="flex border-b border-border">
            {(
              [
                ["objects", "Objects"],
                ["venue", "Venue"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`flex-1 px-3 py-2 text-xs font-medium ${
                  sidebarTab === id
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => {
                  setSidebarTab(id);
                  if (id === "venue") {
                    setSelectedId(VENUE_ID);
                    setTool("select");
                    setPresetId("none");
                  } else {
                    if (selectedId === VENUE_ID) setSelectedId(null);
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
                              setAmenityStamp(a.type);
                              setTool("icon");
                            }}
                          >
                            {a.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
                {tool === "rect" ? (
                  <p className="text-[11px] text-primary">
                    {presetId && presetId !== "none"
                      ? `Click the plan to place a ${PRESETS.find((p) => p.id === presetId)?.label} booth.`
                      : "Drag on the plan to draw a rectangle. Esc cancels."}
                  </p>
                ) : null}
                {tool === "polygon" ? (
                  <p className="text-[11px] text-primary">
                    Click corners on the plan, then Enter to close. Esc cancels.
                  </p>
                ) : null}
                {tool === "icon" ? (
                  <p className="text-[11px] text-primary">
                    Click the plan to place {amenityLabel(amenityStamp).toLowerCase()}. Esc cancels.
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
                        data-active={o.id === selectedId}
                        onClick={() => {
                          setSelectedId(o.id);
                          setTool("select");
                        }}
                        onDoubleClick={() => {
                          setSelectedId(o.id);
                          setTool("select");
                          setFrameNonce((n) => n + 1);
                        }}
                        className="chrome-row"
                      >
                        {s?.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.logoUrl} alt="" className="h-6 w-6 object-contain" />
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
          ) : (
            <div className="min-h-0 overflow-auto p-3">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Edit the drawing, underlay, and scale. Booths stay on the Objects tab.
                </p>
                <div>
                  <Label className="chrome-kicker">Plan</Label>
                  <Select value={floor?.id} onValueChange={setFloorId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {bundle.floors.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-2 flex gap-1">
                    <Input
                      value={newFloorName}
                      onChange={(e) => setNewFloorName(e.target.value)}
                      placeholder="New plan name"
                    />
                    <Button size="sm" variant="outline" onClick={() => void addFloor()}>
                      Add
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="chrome-kicker">Underlay</Label>
                  <Input
                    className="mt-1"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadUnderlay(f);
                    }}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF, PNG, JPG, or SVG. Then enter the hall width and height.
                  </p>
                  <Label className="mt-2 chrome-kicker" htmlFor="underlay-opacity">
                    Drawing strength
                  </Label>
                  <input
                    id="underlay-opacity"
                    type="range"
                    min="0.2"
                    max="1"
                    step="0.05"
                    value={underlayOpacity}
                    onChange={(e) => setUnderlayOpacity(Number(e.target.value))}
                    className="mt-1 w-full accent-primary"
                  />
                </div>

                <div>
                  <Label className="chrome-kicker">Venue size</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Overall width and height of the drawing’s bounding box. Booths keep their real size.
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
            <FloorCanvas
              mode="edit"
              floor={floor}
              objects={objects}
              sponsors={bundle.sponsors}
              selectedId={selectedId}
              frameNonce={frameNonce}
              fitNonce={fitNonce}
              tool={tool}
              units={units}
              amenityStamp={amenityStamp}
              presetMeters={presetId && presetId !== "none" ? preset : null}
              constrainProportions={constrainProportions}
              editLayer={sidebarTab}
              onSelect={setSelectedId}
              onChangeObject={(o) => void patchObject(o)}
              onCreateObject={(o) => {
                void createObject(o);
                setTool("select");
                setPresetId("none");
              }}
              onCalibrated={(n, p) => void onCalibrated(n, p)}
              knownLengthMeters={toMeters(Number(scaleLength), units)}
              underlayOpacity={underlayOpacity}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Add a named plan to start.
            </div>
          )}
          {tool === "calibrate" ? (
            <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2 rounded-md border border-primary/40 bg-background/80 px-3 py-1.5 text-xs text-foreground">
              {Number(scaleLength) > 0
                ? `Click two ends of ${scaleLength} ${units}. Drag to pan.`
                : "Enter a known length in the Venue panel, then click two ends."}
            </div>
          ) : null}
          <div className="pointer-events-none absolute bottom-4 left-4 font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
            pinch / wheel zoom · 0 fits view · handles resize · shift-drag slides drawing
          </div>
        </main>

        <aside className="hidden w-[260px] shrink-0 flex-col border-l border-border bg-background lg:flex">
          <div className="border-b border-border p-3">
            <p className="chrome-kicker">Inspector</p>
            {venueSelected && floor?.calibration ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium">Venue drawing</p>
                <p className="text-xs text-muted-foreground">
                  Drag empty space to pan. Drag orange handles to stretch. Shift-drag the hall to slide the drawing.
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
                <Input
                  value={selected.name}
                  onChange={(e) => void patchObject({ ...selected, name: e.target.value })}
                  placeholder="Label"
                />
                {selected.kind === "booth" ? (
                  <Input
                    value={selected.boothNumber}
                    onChange={(e) => void patchObject({ ...selected, boothNumber: e.target.value })}
                    placeholder="Booth number"
                  />
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
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void patchObject({
                          ...selected,
                          polygon: rotateRing(selected.polygon!, -45),
                          rotation: selected.rotation - 45,
                        })
                      }
                    >
                      Rotate −45°
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void patchObject({
                          ...selected,
                          polygon: rotateRing(selected.polygon!, 45),
                          rotation: selected.rotation + 45,
                        })
                      }
                    >
                      Rotate +45°
                    </Button>
                  </div>
                ) : null}
                <Button size="sm" variant="destructive" onClick={() => void deleteSelected()}>
                  Delete
                </Button>
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
          <ScrollArea className="flex-1 px-3 pb-3">
            <div className="space-y-1">
              {filteredSponsors.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void bindSponsor(s)}
                  className="chrome-row px-2"
                >
                  {s.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logoUrl} alt="" className="h-6 w-6 object-contain" />
                  ) : (
                    <span className="h-6 w-6 rounded bg-muted" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{s.boothNumber}</span>
                </button>
              ))}
              {!bundle.sponsors.length ? (
                <p className="text-xs text-muted-foreground">
                  Sync Airtable in Settings, or keep booths unbound.
                </p>
              ) : null}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
