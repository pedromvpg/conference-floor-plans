"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { MapEvent, Sponsor } from "@/lib/types";
import { StudioKicker, StudioPanel, StudioPills, studioFieldClass, studioPillClass } from "@/components/editor/studio-ui";

type Filter = "all" | "cached" | "uncached";
type Layout = "grid" | "list";
type SortKey = "name" | "tier";
type SortDir = "asc" | "desc";

const TIER_RANK = [
  "title",
  "strategic partners",
  "moon",
  "destination partner",
  "3 block",
  "2 block",
  "1 block",
];

function tierRank(tier: string): number {
  const t = tier.trim().toLowerCase();
  const i = TIER_RANK.findIndex((key) => t === key || t.endsWith(key) || t.includes(key));
  return i === -1 ? 1000 : i;
}

function compareSponsors(a: Sponsor, b: Sponsor, sort: SortKey, dir: SortDir): number {
  let cmp = 0;
  if (sort === "tier") {
    cmp = tierRank(a.tier) - tierRank(b.tier);
    if (!cmp) cmp = a.tier.localeCompare(b.tier, undefined, { sensitivity: "base" });
    if (!cmp) cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  } else {
    cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  }
  return dir === "asc" ? cmp : -cmp;
}

export function SponsorsAssetsForm({
  event,
  initialSponsors,
}: {
  event: MapEvent;
  initialSponsors: Sponsor[];
}) {
  const [sponsors, setSponsors] = useState(initialSponsors);
  const [busy, setBusy] = useState(false);
  const [syncedAt, setSyncedAt] = useState(event.sponsorsSyncedAt);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [layout, setLayout] = useState<Layout>("grid");
  const [sort, setSort] = useState<SortKey>("tier");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${event.slug}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setSponsors(data.sponsors as Sponsor[]);
      setSyncedAt(new Date().toISOString());
      toast.success(`Cached ${data.sponsors.length} sponsors`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  const cachedCount = sponsors.filter((s) => s.logoUrl).length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sponsors
      .filter((s) => {
        const cached = Boolean(s.logoUrl);
        if (filter === "cached" && !cached) return false;
        if (filter === "uncached" && cached) return false;
        if (q) {
          const hay = `${s.name} ${s.boothNumber} ${s.tier} ${s.airtableId}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => compareSponsors(a, b, sort, sortDir));
  }, [sponsors, query, filter, sort, sortDir]);

  return (
    <div className="space-y-8">
      <StudioPanel className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <StudioKicker>Cache</StudioKicker>
          <p className="mt-3 text-[40px] leading-none font-semibold tracking-[-0.05em]">{cachedCount}</p>
          <p className="mt-2 text-[14px] text-muted-foreground">
            logos of {sponsors.length}
            {syncedAt ? ` · last sync ${new Date(syncedAt).toLocaleString("en-GB")}` : " · never synced"}
          </p>
        </div>
        <Button type="button" variant="inverse" size="lg" onClick={() => void sync()} disabled={busy}>
          {busy ? "Caching…" : "Cache logos"}
        </Button>
      </StudioPanel>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          className={`max-w-xs ${studioFieldClass}`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a logo…"
        />
        <StudioPills label="Cache filter">
          {(["all", "cached", "uncached"] as const).map((f) => (
            <button key={f} type="button" className={studioPillClass(filter === f)} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f === "cached" ? "Cached" : "Not cached"}
            </button>
          ))}
        </StudioPills>
        <StudioPills label="Sort">
          {(["tier", "name"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={studioPillClass(sort === key)}
              onClick={() => {
                if (sort === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                else {
                  setSort(key);
                  setSortDir("asc");
                }
              }}
            >
              {key === "tier" ? "Tier" : "Name"}
              {sort === key ? sortDir === "asc" ? <ArrowUp className="ml-1 inline size-3.5" /> : <ArrowDown className="ml-1 inline size-3.5" /> : null}
            </button>
          ))}
        </StudioPills>
        <StudioPills label="Layout">
          <button
            type="button"
            className={studioPillClass(layout === "grid")}
            aria-label="Grid view"
            aria-pressed={layout === "grid"}
            onClick={() => setLayout("grid")}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            className={studioPillClass(layout === "list")}
            aria-label="List view"
            aria-pressed={layout === "list"}
            onClick={() => setLayout("list")}
          >
            <List className="size-4" />
          </button>
        </StudioPills>
      </div>

      {!sponsors.length ? (
        <p className="text-[15px] text-muted-foreground">No sponsors cached yet. Cache logos when Airtable is configured.</p>
      ) : !visible.length ? (
        <p className="text-[15px] text-muted-foreground">
          {query.trim() ? `No sponsors matching “${query.trim()}”.` : "No sponsors in this filter."}
        </p>
      ) : layout === "grid" ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
          {visible.map((s) => (
            <div
              key={s.id}
              className="relative aspect-square overflow-hidden rounded-[18px] bg-[#fcfcfc]"
              title={s.name}
            >
              <Logo src={s.logoUrl} name={s.name} />
              <span
                className={`absolute top-2 right-2 size-1.5 rounded-full ${s.logoUrl ? "bg-[#ff9500]" : "bg-black/25"}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {visible.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <div className="size-11 shrink-0 overflow-hidden rounded-[12px] bg-[#fcfcfc]">
                <Logo src={s.logoUrl} name={s.name} />
              </div>
              <span className="min-w-0 flex-1 truncate text-[15px]">{s.name}</span>
              <span className="hidden font-mono text-[12px] text-muted-foreground sm:inline">{s.boothNumber || "—"}</span>
              <span className="w-36 shrink-0 text-right font-mono text-[12px] text-muted-foreground">{s.tier || "no tier"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Logo({ src, name }: { src: string; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-full w-full object-contain p-2" />
    );
  }
  return (
    <div className="flex h-full items-center justify-center text-lg text-black/35">
      {(name || "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}
