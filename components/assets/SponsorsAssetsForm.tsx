"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { MapEvent, Sponsor } from "@/lib/types";

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
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <p className="chrome-kicker">Airtable</p>
          <CardTitle className="mt-1">Cache sponsors</CardTitle>
          <CardDescription>
            Reads <code className="font-mono text-[11px]">CONF_BITCOINASIA2026</code> (sponsorsToken, sponsorsBaseId,
            sponsorsTable). Pulls <code className="font-mono text-[11px]">Logo Color URL</code> /{" "}
            <code className="font-mono text-[11px]">Logo Color</code>, then Webflow fields. Rasters are downscaled; SVGs
            stay as-is. Read-only token is enough.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="font-mono text-[11px] text-muted-foreground">
            {syncedAt
              ? `${cachedCount} logos cached · last sync ${new Date(syncedAt).toLocaleString()}`
              : "Never synced"}
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="button" onClick={() => void sync()} disabled={busy}>
            {busy ? "Caching…" : "Start caching"}
          </Button>
        </CardFooter>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="chrome-kicker mr-auto">Sponsors</h2>
        <Input
          className="max-w-xs"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a logo…"
        />
        {(["all", "cached", "uncached"] as const).map((f) => (
          <Button
            key={f}
            type="button"
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "cached" ? "Cached" : "Not cached"}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={sort === "name" ? "default" : "outline"}
          onClick={() => {
            if (sort === "name") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            else {
              setSort("name");
              setSortDir("asc");
            }
          }}
        >
          Name
          {sort === "name" ? sortDir === "asc" ? <ArrowUp /> : <ArrowDown /> : null}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={sort === "tier" ? "default" : "outline"}
          onClick={() => {
            if (sort === "tier") setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            else {
              setSort("tier");
              setSortDir("asc");
            }
          }}
        >
          Tier
          {sort === "tier" ? sortDir === "asc" ? <ArrowUp /> : <ArrowDown /> : null}
        </Button>
        <div className="flex border border-border" role="group" aria-label="Layout">
          <Button
            type="button"
            size="icon-sm"
            variant={layout === "grid" ? "default" : "ghost"}
            className="rounded-none"
            aria-label="Grid view"
            aria-pressed={layout === "grid"}
            onClick={() => setLayout("grid")}
          >
            <LayoutGrid />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={layout === "list" ? "default" : "ghost"}
            className="rounded-none"
            aria-label="List view"
            aria-pressed={layout === "list"}
            onClick={() => setLayout("list")}
          >
            <List />
          </Button>
        </div>
      </div>

      {!sponsors.length ? (
        <p className="text-sm text-muted-foreground">No sponsors cached yet. Start caching when Airtable is configured.</p>
      ) : !visible.length ? (
        <p className="text-sm text-muted-foreground">
          {query.trim() ? `No sponsors matching “${query.trim()}”.` : "No sponsors in this filter."}
        </p>
      ) : layout === "grid" ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {visible.map((s) => (
            <div key={s.id} className="relative aspect-square overflow-hidden border border-border bg-white">
              <Logo src={s.logoUrl} name={s.name} />
              <span
                className={`absolute right-1.5 top-1.5 size-2 rounded-full border border-background ${
                  s.logoUrl ? "bg-emerald-500" : "bg-muted-foreground/50"
                }`}
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-background/90 to-transparent px-1.5 pb-1 pt-4 text-[10px]">
                {s.name}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border">
          {visible.map((s) => (
            <div key={s.id} className="chrome-row border-b border-border last:border-b-0">
              <div className="size-10 shrink-0 overflow-hidden border border-border bg-white">
                <Logo src={s.logoUrl} name={s.name} />
              </div>
              <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{s.boothNumber || "—"}</span>
              <span className="w-48 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                {s.tier || "no tier"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Logo({ src, name }: { src: string; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-full w-full object-contain p-1.5" />
    );
  }
  return (
    <div className="flex h-full items-center justify-center text-lg text-muted-foreground">
      {(name || "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}
