"use client";

import dynamic from "next/dynamic";
import { StudioKicker, StudioPanel } from "@/components/editor/studio-ui";
import { EXHIBIT_KIT_LABELS, isStageKitKind, sortExhibitKits } from "@/lib/exhibit-kits";
import { stageKitBreakdown } from "@/lib/stage-seating";
import type { ExhibitKit } from "@/lib/types";

const KitPreview = dynamic(() => import("@/components/hall/KitPreview").then((m) => m.KitPreview), { ssr: false });

function fmt(n: number) {
  return String(Math.round(n * 10) / 10);
}

export function BoothsKitsForm({
  initial,
  group,
}: {
  initial: ExhibitKit[];
  group: "booths" | "stages";
}) {
  const kits = sortExhibitKits(initial).filter((kit) =>
    group === "stages" ? isStageKitKind(kit.kind) : !isStageKitKind(kit.kind),
  );
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        {group === "stages"
          ? "Shared stage templates for this event. Platform height, wall, and seating live on the kit; change them in code."
          : "Shared booth and kiosk templates for this event. Footprint and back-wall height live on the kit; change them in code."}
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {kits.map((kit) => {
          const stage = isStageKitKind(kit.kind);
          const dims = stage ? stageKitBreakdown(kit) : null;
          return (
            <StudioPanel key={kit.kind} className="space-y-4">
              <StudioKicker>{EXHIBIT_KIT_LABELS[kit.kind]}</StudioKicker>
              <KitPreview kit={kit} />
              {dims ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-left font-mono text-[13px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/60 text-[11px] text-muted-foreground">
                        <th className="px-3 py-2 font-medium"> </th>
                        <th className="px-3 py-2 font-medium">Width</th>
                        <th className="px-3 py-2 font-medium">Depth</th>
                        <th className="px-3 py-2 font-medium">Height</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2.5 text-[11px] font-medium text-muted-foreground">Stage area</th>
                        <td className="px-3 py-2.5">{fmt(dims.totalW)} m</td>
                        <td className="px-3 py-2.5">{fmt(dims.totalD)} m</td>
                        <td className="px-3 py-2.5">{fmt(dims.totalH)} m</td>
                      </tr>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2.5 text-[11px] font-medium text-muted-foreground">Platform</th>
                        <td className="px-3 py-2.5">{fmt(dims.platformW)} m</td>
                        <td className="px-3 py-2.5">{fmt(dims.platformD)} m</td>
                        <td className="px-3 py-2.5">{fmt(dims.platformH)} m</td>
                      </tr>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2.5 text-[11px] font-medium text-muted-foreground">LED wall</th>
                        <td className="px-3 py-2.5">{fmt(dims.wallW)} m</td>
                        <td className="px-3 py-2.5 text-muted-foreground">—</td>
                        <td className="px-3 py-2.5">{fmt(dims.wallH)} m</td>
                      </tr>
                      <tr>
                        <th className="px-3 py-2.5 text-[11px] font-medium text-muted-foreground">Seats</th>
                        <td className="px-3 py-2.5" colSpan={3}>
                          {dims.seats}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <dl className="grid gap-3 font-mono text-[13px] sm:grid-cols-3">
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Width</dt>
                    <dd>{kit.widthM} m</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Depth</dt>
                    <dd>{kit.depthM} m</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Back wall</dt>
                    <dd>{kit.wallHeightM} m</dd>
                  </div>
                </dl>
              )}
            </StudioPanel>
          );
        })}
      </div>
    </div>
  );
}
