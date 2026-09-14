"use client";

import dynamic from "next/dynamic";
import { StudioKicker, StudioPanel } from "@/components/editor/studio-ui";
import { EXHIBIT_KIT_LABELS, isStageKitKind, sortExhibitKits } from "@/lib/exhibit-kits";
import type { ExhibitKit } from "@/lib/types";

const KitPreview = dynamic(() => import("@/components/hall/KitPreview").then((m) => m.KitPreview), { ssr: false });

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
          return (
            <StudioPanel key={kit.kind} className="space-y-4">
              <StudioKicker>{EXHIBIT_KIT_LABELS[kit.kind]}</StudioKicker>
              <KitPreview kit={kit} />
              <dl className={`grid gap-3 font-mono text-[13px] ${stage ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
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
                {stage ? (
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Platform</dt>
                    <dd>{kit.platformHeightM ?? 0.9} m</dd>
                  </div>
                ) : null}
              </dl>
              {kit.instructions ? (
                <p className="text-[13px] leading-relaxed text-muted-foreground">{kit.instructions}</p>
              ) : null}
            </StudioPanel>
          );
        })}
      </div>
    </div>
  );
}
