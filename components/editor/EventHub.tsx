import Link from "next/link";
import type { DraftBundle } from "@/lib/types";
import { hubModel } from "@/lib/studio-hub";
import { CopyPath } from "@/components/editor/CopyPath";
import { StudioKicker, StudioPanel } from "@/components/editor/studio-ui";
import { Button } from "@/components/ui/button";
import { formatSize } from "@/lib/units";
import { EXHIBIT_KIT_LABELS, isStageKitKind, sortExhibitKits } from "@/lib/exhibit-kits";

export function EventHub({ draft, airtableLoaded }: { draft: DraftBundle; airtableLoaded: boolean }) {
  const slug = draft.event.slug;
  const hub = hubModel(draft, airtableLoaded);
  const viewer = `/e/${slug}`;
  const json = `/e/${slug}/map.json`;

  return (
    <div className="space-y-8">
      <StudioPanel className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <StudioKicker>Snapshot</StudioKicker>
          <p className="mt-3 font-mono text-[13px] text-muted-foreground">
            {hub.publishedLabel}
            {hub.publishedBy ? ` · ${hub.publishedBy}` : ""}
          </p>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Draft versus the public map. Fix the list below, then publish from the designer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="glass" size="lg">
            <Link href={viewer}>Open viewer</Link>
          </Button>
          <Button asChild variant="inverse" size="lg">
            <Link href={`/e/${slug}/edit`}>Open designer</Link>
          </Button>
        </div>
      </StudioPanel>

      <section>
        <StudioKicker>Needs attention</StudioKicker>
        {hub.issues.length ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {hub.issues.map((issue) => (
              <li key={issue.label}>
                <Link href={issue.href} className="block py-4 hover:text-foreground">
                  <p className="text-[16px] font-medium tracking-[-0.02em]">{issue.label}</p>
                  <p className="mt-1 text-[14px] text-muted-foreground">{issue.detail}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[15px] text-muted-foreground">
            Floors are scaled, a snapshot is live, and caches have files. Publish from the designer if the canvas
            moved.
          </p>
        )}
      </section>

      <section>
        <StudioKicker>Floors</StudioKicker>
        {hub.floors.length ? (
          <table className="mt-4 w-full text-left text-[14px]">
            <thead className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="pb-3 font-medium">Plan</th>
                <th className="pb-3 font-medium">Source</th>
                <th className="pb-3 font-medium">Booths</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {hub.floors.map((floor) => (
                <tr key={floor.id}>
                  <td className="py-3 font-medium">{floor.name}</td>
                  <td className="py-3 text-muted-foreground">
                    {floor.underlay ? (floor.scaled ? "Underlay, scaled" : "Underlay, no scale") : "No underlay"}
                  </td>
                  <td className="py-3 font-mono text-[13px] text-muted-foreground">
                    {floor.booths}
                    {floor.booths ? ` · ${floor.bound} bound` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-[15px] text-muted-foreground">No plans yet.</p>
        )}
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="flex items-end justify-between gap-3">
            <StudioKicker>Booths</StudioKicker>
            <Button asChild variant="glass" size="sm">
              <Link href={`/e/${slug}/booths`}>View booths</Link>
            </Button>
          </div>
          <ul className="mt-4 grid gap-2">
            {sortExhibitKits(draft.kits ?? [])
              .filter((kit) => !isStageKitKind(kit.kind))
              .map((kit) => (
                <li
                  key={kit.kind}
                  className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-muted/40 px-4 py-3"
                >
                  <p className="text-[14px] font-medium">{EXHIBIT_KIT_LABELS[kit.kind]}</p>
                  <p className="font-mono text-[12px] text-muted-foreground">
                    {formatSize(kit.widthM, kit.depthM, "m")} · {kit.wallHeightM} m wall
                  </p>
                </li>
              ))}
          </ul>
        </div>
        <div>
          <div className="flex items-end justify-between gap-3">
            <StudioKicker>Stages</StudioKicker>
            <Button asChild variant="glass" size="sm">
              <Link href={`/e/${slug}/stages`}>View stages</Link>
            </Button>
          </div>
          <ul className="mt-4 grid gap-2">
            {sortExhibitKits(draft.kits ?? [])
              .filter((kit) => isStageKitKind(kit.kind))
              .map((kit) => (
                <li
                  key={kit.kind}
                  className="flex items-center justify-between gap-3 rounded-[18px] border border-border bg-muted/40 px-4 py-3"
                >
                  <p className="text-[14px] font-medium">{EXHIBIT_KIT_LABELS[kit.kind]}</p>
                  <p className="font-mono text-[12px] text-muted-foreground">
                    {formatSize(kit.widthM, kit.depthM, "m")} · {kit.wallHeightM} m wall
                  </p>
                </li>
              ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StudioPanel>
          <StudioKicker>Sponsors</StudioKicker>
          <p className="mt-3 text-[32px] leading-none font-semibold tracking-[-0.04em]">{hub.counts.logos}</p>
          <p className="mt-2 text-[14px] text-muted-foreground">
            logos of {hub.counts.sponsors} · {hub.sync.sponsors}
          </p>
        </StudioPanel>
        <StudioPanel>
          <StudioKicker>Agenda</StudioKicker>
          <p className="mt-3 text-[32px] leading-none font-semibold tracking-[-0.04em]">{hub.counts.sessions}</p>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {hub.counts.speakers} speakers · {hub.sync.agenda}
          </p>
        </StudioPanel>
        <StudioPanel>
          <StudioKicker>Library</StudioKicker>
          <p className="mt-3 text-[32px] leading-none font-semibold tracking-[-0.04em]">{hub.counts.assets}</p>
          <p className="mt-2 text-[14px] text-muted-foreground">textures and models</p>
        </StudioPanel>
      </section>

      <section>
        <StudioKicker>Public URLs</StudioKicker>
        <ul className="mt-4 space-y-2">
          {[
            [viewer, "Viewer"],
            [json, "map.json"],
          ].map(([path, label]) => (
            <li
              key={path}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-border bg-muted/40 px-4 py-3"
            >
              <div>
                <p className="text-[13px] text-muted-foreground">{label}</p>
                <p className="font-mono text-[13px] text-foreground">{path}</p>
              </div>
              <div className="flex gap-2">
                <CopyPath path={path} />
                <Button asChild variant="glass" size="sm">
                  <Link href={path}>Open</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
