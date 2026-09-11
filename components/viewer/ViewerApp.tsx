"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronLeft, LayoutGrid, MapPin, Search, SlidersHorizontal, Square, Theater } from "lucide-react";
import { FloorCanvas } from "@/components/map/FloorCanvas";
import { FloorSwitcher, HALL_VIEW_ASIDE_W, HallViewAside, ViewModeToggle } from "@/components/map/ViewModeToggle";
import { DEFAULT_HALL_VIEW, type HallView } from "@/lib/hall-view";
import { UnitsToggle } from "@/components/units-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { upcomingOnStage, speakersForSession } from "@/lib/agenda-match";
import { amenityLabel } from "@/lib/amenities";
import { ringBounds } from "@/lib/geometry";
import { displayLogoUrl } from "@/lib/hall";
import { formatSize } from "@/lib/units";
import { useUnits } from "@/lib/use-units";
import { isMapPinObject, MAP_PIN_META } from "@/lib/types";
import type { Appearance, Floor, MapDocument, MapObject, Sponsor, ViewMode } from "@/lib/types";

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
  if (o.kind === "amenity" || isMapPinObject(o)) return "icons";
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

function objectsFromDoc(doc: MapDocument, floorId: string): { objects: MapObject[]; sponsors: Sponsor[] } {
  const floor = doc.floors.find((f) => f.id === floorId);
  const sponsors: Sponsor[] = doc.sponsors.map((s, i) => ({
    id: s.airtableId || `s-${i}`,
    eventId: doc.event.slug,
    airtableId: s.airtableId,
    name: s.name,
    tier: s.tier,
    boothNumber: s.boothNumber,
    logoUrl: s.logoUrl,
    logoWhiteUrl: s.logoWhiteUrl,
  }));
  const byAir = new Map(sponsors.map((s) => [s.airtableId, s]));
  const objects: MapObject[] = (floor?.features.features ?? []).map((feat) => {
    const p = feat.properties ?? {};
    const id = String(feat.id ?? crypto.randomUUID());
    const kind = (p.kind as MapObject["kind"]) || "booth";
    const airtableId = (p.airtableId as string) || "";
    const sponsor = airtableId ? byAir.get(airtableId) : undefined;
    const hall = {
      appearance: (p.appearance as Appearance) ?? null,
      facingDeg: Number(p.facingDeg ?? 0),
      modelAssetId: null as string | null,
      rugTextureAssetId: null as string | null,
      wallTextureAssetId: null as string | null,
      logoAssetId: null as string | null,
      fillTextureAssetId: null as string | null,
      modelUrl: String(p.modelUrl ?? ""),
      rugTextureUrl: String(p.rugTextureUrl ?? ""),
      wallTextureUrl: String(p.wallTextureUrl ?? ""),
      logoUrl: String(p.logoUrl ?? ""),
      fillTextureUrl: String(p.fillTextureUrl ?? ""),
    };
    if (feat.geometry.type === "Point") {
      const rawKind = p.kind as MapObject["kind"];
      const kind = rawKind === "side_event" || rawKind === "hotel" ? rawKind : "amenity";
      return {
        id,
        floorId,
        kind,
        polygon: null,
        x: feat.geometry.coordinates[0],
        y: feat.geometry.coordinates[1],
        rotation: Number(p.rotation ?? 0),
        boothNumber: "",
        name: String(p.name ?? ""),
        description: String(p.description ?? ""),
        eventDate: String(p.eventDate ?? ""),
        sponsorId: null,
        amenityType: kind === "amenity" ? ((p.amenityType as MapObject["amenityType"]) ?? "info") : null,
        color: typeof p.color === "string" ? p.color : null,
        ...hall,
        createdAt: "",
        updatedAt: "",
      };
    }
    const ring = feat.geometry.coordinates[0] ?? [];
    return {
      id,
      floorId,
      kind,
      polygon: ring,
      x: null,
      y: null,
      rotation: Number(p.rotation ?? 0),
      boothNumber: String(p.boothNumber ?? ""),
      name: String(p.name ?? ""),
      description: String(p.description ?? ""),
      eventDate: String(p.eventDate ?? ""),
      sponsorId: sponsor?.id ?? null,
      amenityType: null,
      color: typeof p.color === "string" ? p.color : null,
      ...hall,
      createdAt: "",
      updatedAt: "",
    };
  });
  return { objects, sponsors };
}

function inheritPublishedFloor(
  f: MapDocument["floors"][number],
  floors: MapDocument["floors"],
): MapDocument["floors"][number] {
  const primary = [...floors].sort((a, b) => a.order - b.order)[0];
  if (!primary || primary.id === f.id) return f;
  const emptyCal = !f.underlay.widthPx && !f.underlay.heightPx;
  return {
    ...f,
    underlay: emptyCal ? { ...primary.underlay, url: f.underlay.url } : f.underlay,
    basemap: f.basemap ?? primary.basemap ?? null,
  };
}

function floorFromDoc(f: MapDocument["floors"][number], eventId: string): Floor {
  return {
    id: f.id,
    eventId,
    name: f.name,
    sortOrder: f.order,
    underlayUrl: f.underlay.url,
    originalUrl: f.underlay.url,
    calibration: {
      originX: f.underlay.originX,
      originY: f.underlay.originY,
      metersPerPixel: f.underlay.metersPerPixel,
      metersPerPixelY: f.underlay.metersPerPixelY ?? f.underlay.metersPerPixel,
      rotationDeg: f.underlay.rotationDeg,
      widthPx: f.underlay.widthPx,
      heightPx: f.underlay.heightPx,
    },
    basemap: f.basemap ?? null,
    createdAt: "",
    updatedAt: "",
  };
}

function Detail({
  selected,
  sponsor,
  doc,
}: {
  selected: MapObject;
  sponsor?: Sponsor;
  doc: MapDocument;
}) {
  const next = upcomingOnStage(doc.sessions, selected);
  const speakers = next ? speakersForSession(next.speakerIds, doc.speakers) : [];
  const logoUrl = displayLogoUrl(selected, [], sponsor);
  if (isMapPinObject(selected)) {
    const when = selected.eventDate
      ? new Date(`${selected.eventDate}T12:00:00`).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";
    return (
      <div className="space-y-3">
        {logoUrl ? (
          <div className="overflow-hidden border border-border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" className="max-h-40 w-full object-cover" />
          </div>
        ) : null}
        {when ? <p className="font-mono text-[11px] text-muted-foreground">{when}</p> : null}
        {selected.description ? <p className="text-[13px] leading-snug whitespace-pre-wrap">{selected.description}</p> : null}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {logoUrl ? (
        <div className="mx-auto w-fit bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" className="h-14 object-contain" />
        </div>
      ) : null}
      {next ? (
        <div className="border-t border-border pt-2">
          <p className="chrome-kicker">Up next</p>
          <p className="mt-1 text-[13px]">{next.title}</p>
          <p className="font-mono text-[10px] text-muted-foreground">
            {next.startUnix ? new Date(next.startUnix * 1000).toLocaleString() : ""}
            {next.sessionType ? ` · ${next.sessionType}` : ""}
          </p>
          {speakers.length ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{speakers.map((s) => s.name).join(", ")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ViewerApp({
  doc,
  highlightBooth,
  highlightAirtable,
}: {
  doc: MapDocument;
  highlightBooth?: string;
  highlightAirtable?: string;
}) {
  const [floorId, setFloorId] = useState(doc.floors[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frameNonce, setFrameNonce] = useState(0);
  const [venueNonce, setVenueNonce] = useState(0);
  const [units, setUnits] = useUnits();
  const [detailOpen, setDetailOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [objectFilter, setObjectFilter] = useState<ObjectFilter>("all");
  const [objectSort, setObjectSort] = useState<ObjectSort>("name");
  const [objectSortDir, setObjectSortDir] = useState<SortDir>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("plan");
  const [hallView, setHallView] = useState<HallView>(DEFAULT_HALL_VIEW);
  const [hallSettingsOpen, setHallSettingsOpen] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setViewMode("hall");
    else setSidebarOpen(false);
  }, []);

  const floorDocRaw = doc.floors.find((f) => f.id === floorId) ?? doc.floors[0];
  const floorDoc = floorDocRaw ? inheritPublishedFloor(floorDocRaw, doc.floors) : undefined;
  const floor = floorDoc ? floorFromDoc(floorDoc, doc.event.slug) : null;
  const { objects, sponsors } = useMemo(
    () => (floorDoc ? objectsFromDoc(doc, floorDoc.id) : { objects: [], sponsors: [] }),
    [doc, floorDoc],
  );

  const highlightId = useMemo(() => {
    const qBooth = highlightBooth?.toLowerCase();
    const qAir = highlightAirtable;
    return (
      objects.find((o) => {
        if (qAir) {
          const s = sponsors.find((sp) => sp.id === o.sponsorId);
          if (s?.airtableId === qAir) return true;
        }
        if (qBooth && o.boothNumber.toLowerCase() === qBooth) return true;
        if (qBooth && o.name.toLowerCase() === qBooth) return true;
        return false;
      })?.id ?? null
    );
  }, [objects, sponsors, highlightBooth, highlightAirtable]);

  const selected = objects.find((o) => o.id === selectedId) ?? objects.find((o) => o.id === highlightId);
  const selectedSponsor = selected?.sponsorId
    ? sponsors.find((s) => s.id === selected.sponsorId)
    : undefined;

  const tiers = [...new Set(sponsors.map((s) => s.tier).filter(Boolean))];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = objects.filter((o) => {
      const s = o.sponsorId ? sponsors.find((sp) => sp.id === o.sponsorId) : undefined;
      if (tier && s?.tier !== tier) return false;
      if (q) {
        const blob = `${o.name} ${o.boothNumber} ${o.description} ${o.eventDate} ${s?.name ?? ""} ${s?.tier ?? ""} ${o.amenityType ?? ""} ${o.kind}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (isMapPinObject(o)) return objectFilter === "all";
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
      const sa = a.sponsorId ? sponsors.find((sp) => sp.id === a.sponsorId) : undefined;
      const sb = b.sponsorId ? sponsors.find((sp) => sp.id === b.sponsorId) : undefined;
      const byName = objectTitle(a, sa).localeCompare(objectTitle(b, sb));
      let cmp = 0;
      if (objectSort === "size") cmp = objectArea(a) - objectArea(b);
      else if (objectSort === "modified") cmp = Date.parse(a.updatedAt || "0") - Date.parse(b.updatedAt || "0");
      else cmp = byName;
      if (cmp === 0) cmp = byName;
      return objectSortDir === "asc" ? cmp : -cmp;
    });
  }, [objects, sponsors, query, tier, objectFilter, objectSort, objectSortDir]);

  function openItem(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
  }

  function selectFromMap(id: string | null) {
    setSelectedId(id);
    setDetailOpen(Boolean(id));
  }

  function frameItem(id: string) {
    setSelectedId(id);
    setFrameNonce((n) => n + 1);
  }

  const list = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-border px-3 py-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exhibitors"
        />
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
                  aria-label="Filter and sort"
                  className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  <ChevronDown
                    className={`size-4 shrink-0 ${objectSortDir === "desc" ? "rotate-180" : ""}`}
                    strokeWidth={1.5}
                  />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Filter and sort</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="min-w-52">
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
            {tiers.length ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Filter</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={tier || "__all__"}
                  onValueChange={(v) => setTier(v === "__all__" ? "" : v)}
                >
                  <DropdownMenuRadioItem value="__all__">All</DropdownMenuRadioItem>
                  {tiers.slice(0, 8).map((t) => (
                    <DropdownMenuRadioItem key={t} value={t}>
                      {t}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-1">
          {results.map((o, i) => {
            const s = o.sponsorId ? sponsors.find((sp) => sp.id === o.sponsorId) : undefined;
            const title = objectTitle(o, s);
            const logoUrl = displayLogoUrl(o, [], s);
            const group = objectListGroup(o);
            const showGroup =
              objectFilter === "all" &&
              (i === 0 || objectListGroup(results[i - 1]) !== group);
            const sub = isMapPinObject(o)
              ? MAP_PIN_META[o.kind].label
              : o.kind === "amenity"
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
                  data-active={o.id === selected?.id}
                  onClick={() => openItem(o.id)}
                  onDoubleClick={() => frameItem(o.id)}
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
          {!results.length ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No {objectFilter === "all" ? "objects" : objectFilter} on this plan.
            </p>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="relative h-dvh overflow-clip bg-background">
      <main
        className="absolute inset-y-0 overflow-clip transition-[right] duration-200 ease-in-out"
        style={{
          left: sidebarOpen ? 260 : 40,
          right: hallSettingsOpen ? HALL_VIEW_ASIDE_W : 0,
        }}
      >
        {floor ? (
          viewMode === "hall" ? (
            <HallCanvas
              mode="view"
              floor={floor}
              objects={objects}
              sponsors={sponsors}
              selectedId={selected?.id ?? null}
              highlightId={highlightId}
              frameNonce={frameNonce}
              venueNonce={venueNonce}
              units={units}
              orthographic={hallView.orthographic}
              cuboids={hallView.cuboids}
              fog={hallView.fog}
              fogIntensity={hallView.fogIntensity}
              ao={hallView.ao}
              shadows={hallView.shadows}
              environment={hallView.environment}
              pathTracing={hallView.pathTracing}
              azimuth={hallView.azimuth}
              elevation={hallView.elevation}
              distance={hallView.distance}
              lightAzimuth={hallView.lightAzimuth}
              lightElevation={hallView.lightElevation}
              lightDistance={hallView.lightDistance}
              lightIntensity={hallView.lightIntensity}
              fill={hallView.fill}
              onSelect={selectFromMap}
            />
          ) : (
            <FloorCanvas
              mode="view"
              floor={floor}
              objects={objects}
              sponsors={sponsors}
              selectedId={selectedId}
              frameNonce={frameNonce}
              venueNonce={venueNonce}
              highlightId={highlightId}
              units={units}
              onSelect={selectFromMap}
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
            Map has not been published yet.
          </div>
        )}

        <div className="pointer-events-auto absolute bottom-4 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-nowrap items-center justify-center gap-1 overflow-x-auto rounded-xl border border-border bg-background/80 p-1 shadow-sm backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ViewModeToggle
            value={viewMode}
            onChange={(mode) => {
              setViewMode(mode);
              setFrameNonce(0);
              setVenueNonce((n) => n + 1);
            }}
          />
          {viewMode === "hall" ? (
            <Button
              size="icon-sm"
              variant={hallSettingsOpen ? "secondary" : "ghost"}
              className="size-8"
              title="3D view"
              aria-label="3D view settings"
              aria-pressed={hallSettingsOpen}
              onClick={() => setHallSettingsOpen((open) => !open)}
            >
              <SlidersHorizontal strokeWidth={1.5} />
            </Button>
          ) : null}
          <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <FloorSwitcher
            floors={[...doc.floors].sort((a, b) => a.order - b.order)}
            value={floorId}
            onChange={(id) => {
              setFloorId(id);
              setSelectedId(null);
            }}
          />
          <UnitsToggle units={units} onChange={setUnits} />
          <ThemeToggle />
        </div>
      </main>

      {hallSettingsOpen ? (
        <div className="absolute inset-y-0 right-0 z-10">
          <HallViewAside
            hallView={hallView}
            onHallViewChange={(patch) => setHallView((prev) => ({ ...prev, ...patch }))}
            onClose={() => setHallSettingsOpen(false)}
          />
        </div>
      ) : null}

      <aside
        className="absolute top-0 left-0 bottom-0 z-10 flex flex-col border-r border-border bg-background"
        style={{ width: sidebarOpen ? 260 : 40 }}
      >
        <div className="flex h-10 shrink-0 items-center border-b border-border px-1">
          <button
            type="button"
            className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Collapse list" : "Expand list"}
          >
            <ChevronLeft className={`size-4 shrink-0 transition-transform ${sidebarOpen ? "" : "rotate-180"}`} strokeWidth={1.5} />
          </button>
        </div>
        {sidebarOpen ? list : (
          <button
            type="button"
            className="mx-auto mt-1 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setSidebarOpen(true)}
            aria-label="Search"
          >
            <Search className="size-4 shrink-0" strokeWidth={1.5} />
          </button>
        )}
      </aside>

      <Dialog modal={false} open={detailOpen && Boolean(selected)} onOpenChange={setDetailOpen}>
        <DialogContent
          overlayClassName="bg-transparent backdrop-blur-none supports-backdrop-filter:backdrop-blur-none pointer-events-none"
          className={`top-4 left-4 w-[min(22rem,calc(100%-2rem))] max-w-sm translate-x-0 translate-y-0 rounded-xl sm:max-w-sm ${sidebarOpen ? "md:left-[276px]" : "md:left-[56px]"}`}
        >
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedSponsor?.name || selected.name || selected.boothNumber || (isMapPinObject(selected) ? MAP_PIN_META[selected.kind].label : amenityLabel(selected.amenityType ?? "info"))}
                </DialogTitle>
                <DialogDescription>
                  {selected.boothNumber
                    ? `Booth ${selected.boothNumber}${selectedSponsor?.tier ? ` · ${selectedSponsor.tier}` : ""}`
                    : isMapPinObject(selected)
                      ? selected.eventDate || MAP_PIN_META[selected.kind].label
                      : selectedSponsor?.tier || (selected.amenityType ? amenityLabel(selected.amenityType) : "Location")}
                </DialogDescription>
              </DialogHeader>
              <Detail selected={selected} sponsor={selectedSponsor} doc={doc} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
