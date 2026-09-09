"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, Search } from "lucide-react";
import { FloorCanvas } from "@/components/map/FloorCanvas";
import { FloorSwitcher, GridToggle, ViewModeToggle } from "@/components/map/ViewModeToggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { upcomingOnStage, speakersForSession } from "@/lib/agenda-match";
import { amenityLabel } from "@/lib/amenities";
import { ringBounds } from "@/lib/geometry";
import { displayLogoUrl } from "@/lib/hall";
import { useUnits } from "@/lib/use-units";
import type { Appearance, Floor, MapDocument, MapObject, Sponsor, ViewMode } from "@/lib/types";

const HallCanvas = dynamic(() => import("@/components/hall/HallCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#12110f] font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
      Loading hall…
    </div>
  ),
});

type LocationTab = "all" | "booths" | "stages" | "size" | "theme";

const LOCATION_TABS: { value: LocationTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "booths", label: "Booths" },
  { value: "stages", label: "Stages" },
  { value: "size", label: "Size" },
  { value: "theme", label: "Theme" },
];

function isStage(o: MapObject): boolean {
  return /\bstage\b/i.test(`${o.name} ${o.boothNumber}`);
}

function isBooth(o: MapObject): boolean {
  return o.kind === "booth" && !isStage(o);
}

function polygonArea(o: MapObject): number {
  if (!o.polygon?.length) return 0;
  const b = ringBounds(o.polygon);
  return b.w * b.h;
}

function objectTitle(o: MapObject, sponsor?: Sponsor): string {
  return sponsor?.name || o.name || o.boothNumber || amenityLabel(o.amenityType ?? "info");
}

function themeOf(o: MapObject, sponsor?: Sponsor): string {
  if (sponsor?.tier) return sponsor.tier;
  if (isStage(o)) return "Stages";
  if (o.kind === "amenity") return amenityLabel(o.amenityType ?? "info");
  return o.name || "Untitled";
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
      return {
        id,
        floorId,
        kind: "amenity" as const,
        polygon: null,
        x: feat.geometry.coordinates[0],
        y: feat.geometry.coordinates[1],
        rotation: Number(p.rotation ?? 0),
        boothNumber: "",
        name: String(p.name ?? ""),
        sponsorId: null,
        amenityType: (p.amenityType as MapObject["amenityType"]) ?? "info",
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
  const [units, setUnits] = useUnits();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [locationTab, setLocationTab] = useState<LocationTab>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("plan");
  const [showGrid, setShowGrid] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setViewMode("hall");
  }, []);

  const floorDoc = doc.floors.find((f) => f.id === floorId) ?? doc.floors[0];
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
        const blob = `${o.name} ${o.boothNumber} ${s?.name ?? ""} ${s?.tier ?? ""} ${o.amenityType ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      } else if (locationTab === "all" || locationTab === "theme") {
        if (o.kind !== "booth" && !o.name) return false;
      }
      if (locationTab === "booths") return isBooth(o);
      if (locationTab === "stages") return isStage(o);
      if (locationTab === "size") return Boolean(o.polygon?.length);
      return true;
    });
    const ranked = [...matches];
    if (locationTab === "size") {
      ranked.sort((a, b) => polygonArea(b) - polygonArea(a));
    } else {
      ranked.sort((a, b) => {
        const sa = a.sponsorId ? sponsors.find((sp) => sp.id === a.sponsorId) : undefined;
        const sb = b.sponsorId ? sponsors.find((sp) => sp.id === b.sponsorId) : undefined;
        return objectTitle(a, sa).localeCompare(objectTitle(b, sb));
      });
    }
    return ranked;
  }, [objects, sponsors, query, tier, locationTab]);

  const themeGroups = useMemo(() => {
    if (locationTab !== "theme") return null;
    const groups = new Map<string, MapObject[]>();
    for (const o of results) {
      const s = o.sponsorId ? sponsors.find((sp) => sp.id === o.sponsorId) : undefined;
      const key = themeOf(o, s);
      const list = groups.get(key);
      if (list) list.push(o);
      else groups.set(key, [o]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [locationTab, results, sponsors]);

  function openItem(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
    setSheetOpen(false);
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
        {tiers.length ? (
          <div className="flex flex-wrap gap-1">
            <button type="button" className="chrome-pill h-7 min-h-0 px-2" data-active={tier === ""} onClick={() => setTier("")}>
              All
            </button>
            {tiers.slice(0, 8).map((t) => (
              <button key={t} type="button" className="chrome-pill h-7 min-h-0 px-2" data-active={tier === t} onClick={() => setTier(t)}>
                {t}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p className="chrome-kicker px-3 pt-3">Locations</p>
      <Tabs
        value={locationTab}
        onValueChange={(value) => setLocationTab(value as LocationTab)}
        className="shrink-0 gap-0 bg-background px-2 pb-1"
      >
        <TabsList
          variant="line"
          className="grid h-auto w-full grid-cols-3 gap-0 rounded-none p-0 group-data-horizontal/tabs:h-auto"
        >
          {LOCATION_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-7 flex-none px-2 text-[10px] tracking-wide uppercase"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <ScrollArea className="flex-1">
        <div className="py-1">
          {(themeGroups ?? [["", results]]).map(([group, items]) => (
            <div key={group || "all"}>
              {group ? <p className="chrome-kicker px-3 pt-2 pb-1">{group}</p> : null}
              {items.map((o) => {
                const s = o.sponsorId ? sponsors.find((sp) => sp.id === o.sponsorId) : undefined;
                const title = objectTitle(o, s);
                const area = locationTab === "size" ? polygonArea(o) : 0;
                const sub =
                  locationTab === "size" && area > 0
                    ? `${Math.round(area)} m²`
                    : o.boothNumber && o.boothNumber !== title
                      ? o.boothNumber
                      : "";
                return (
                  <button
                    key={o.id}
                    type="button"
                    data-active={o.id === selected?.id}
                    onClick={() => openItem(o.id)}
                    onDoubleClick={() => frameItem(o.id)}
                    className="chrome-row"
                  >
                    {displayLogoUrl(o, [], s) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={displayLogoUrl(o, [], s)} alt="" className="h-6 w-6 bg-white object-contain p-0.5" />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{title}</span>
                    {sub ? <span className="font-mono text-[10px] text-muted-foreground">{sub}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="relative h-dvh overflow-clip bg-background">
      <main
        className="absolute inset-y-0 right-0 overflow-clip"
        style={{ left: sidebarOpen ? 260 : 44 }}
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
              units={units}
              showGrid={showGrid}
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
              highlightId={highlightId}
              units={units}
              showGrid={showGrid}
              onSelect={selectFromMap}
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
            Map has not been published yet.
          </div>
        )}
      </main>

      <div className="pointer-events-none absolute top-4 right-4 z-20 font-mono text-[11px] tracking-wide text-muted-foreground">
        <p>
          <span className="text-primary">$</span> <span className="text-muted-foreground">map</span>{" "}
          <span className="text-foreground">{doc.event.name}</span>
        </p>
      </div>

      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-wrap justify-center gap-2.5">
        <GridToggle value={showGrid} onChange={setShowGrid} />
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
        <FloorSwitcher
          floors={[...doc.floors].sort((a, b) => a.order - b.order)}
          value={floorId}
          onChange={(id) => {
            setFloorId(id);
            setSelectedId(null);
          }}
        />
        <button type="button" className="chrome-pill" data-active={units === "m"} onClick={() => setUnits("m")}>
          m
        </button>
        <button type="button" className="chrome-pill" data-active={units === "ft"} onClick={() => setUnits("ft")}>
          ft
        </button>
        <button
          type="button"
          className="chrome-pill md:hidden"
          onClick={() => setSheetOpen(true)}
        >
          <Search className="size-3.5" />
          Search
        </button>
        <div className="md:hidden">
          <ThemeToggle />
        </div>
      </div>

      <aside
        className="absolute top-0 left-0 bottom-0 z-10 hidden border-r border-border bg-background md:flex md:flex-col"
        style={{ width: sidebarOpen ? 260 : 44 }}
      >
        <div className="flex shrink-0 items-center border-b border-border">
          {sidebarOpen ? <div className="pl-1"><ThemeToggle /></div> : null}
          <button
            type="button"
            className="ml-auto flex size-11 shrink-0 items-center justify-center text-foreground hover:text-primary"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Collapse list" : "Expand list"}
          >
            <ChevronLeft className={`size-4 transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {sidebarOpen ? list : (
          <button
            type="button"
            className="flex size-11 items-center justify-center text-muted-foreground hover:text-primary"
            onClick={() => setSidebarOpen(true)}
            aria-label="Search"
          >
            <Search className="size-4" />
          </button>
        )}
      </aside>

      <Dialog modal={false} open={detailOpen && Boolean(selected)} onOpenChange={setDetailOpen}>
        <DialogContent
          overlayClassName="bg-transparent backdrop-blur-none supports-backdrop-filter:backdrop-blur-none pointer-events-none"
          className={`top-4 left-4 w-[min(22rem,calc(100%-2rem))] max-w-sm translate-x-0 translate-y-0 rounded-none sm:max-w-sm ${sidebarOpen ? "md:left-[276px]" : "md:left-[60px]"}`}
        >
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedSponsor?.name || selected.name || selected.boothNumber || amenityLabel(selected.amenityType ?? "info")}
                </DialogTitle>
                <DialogDescription>
                  {selected.boothNumber
                    ? `Booth ${selected.boothNumber}${selectedSponsor?.tier ? ` · ${selectedSponsor.tier}` : ""}`
                    : selectedSponsor?.tier || (selected.amenityType ? amenityLabel(selected.amenityType) : "Location")}
                </DialogDescription>
              </DialogHeader>
              <Detail selected={selected} sponsor={selectedSponsor} doc={doc} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[75dvh] rounded-none border-border bg-background md:hidden">
          <SheetHeader>
            <SheetTitle className="text-sm">Search</SheetTitle>
          </SheetHeader>
          <div className="h-72">{list}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
