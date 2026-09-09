"use client";

import dynamic from "next/dynamic";
import type { ReactNode, RefObject, WheelEvent } from "react";
import type { LeafletCam } from "./OsmBasemap";
import type { FloorBasemap } from "@/lib/types";

const OsmBasemap = dynamic(() => import("./OsmBasemap").then((m) => m.OsmBasemap), {
  ssr: false,
});

export function PlanStage({
  basemap,
  leafletCam,
  svgRef,
  hall,
  onWheel,
  children,
}: {
  basemap: FloorBasemap | null;
  leafletCam?: LeafletCam | null;
  svgRef: RefObject<SVGSVGElement | null>;
  hall: { x: number; y: number; lat: number; lng: number };
  onWheel?: (e: WheelEvent) => void;
  children: ReactNode;
}) {
  const show = Boolean(basemap?.enabled);
  return (
    <div className="relative h-full w-full overflow-clip" onWheel={onWheel}>
      {show && basemap && leafletCam ? (
        <OsmBasemap view={basemap} camera={leafletCam} svgRef={svgRef} hall={hall} />
      ) : null}
      <div className="absolute inset-0 z-10">{children}</div>
    </div>
  );
}
