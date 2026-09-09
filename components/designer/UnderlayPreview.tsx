"use client";

import { isRasterUnderlay, isSvgUnderlay } from "@/lib/svg-layers";
import type { Floor } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  floor: Floor;
  /** Live SVG markup for the floor currently being edited. */
  svgMarkup?: string | null;
  faded?: boolean;
};

export function UnderlayPreview({ floor, svgMarkup, faded }: Props) {
  const raster =
    (isRasterUnderlay(floor.originalUrl) ? floor.originalUrl : null) ||
    (isRasterUnderlay(floor.underlayUrl) ? floor.underlayUrl : null);
  const svgUrl = isSvgUnderlay(floor.underlayUrl) ? floor.underlayUrl : null;
  const inlineSvg = svgUrl && svgMarkup?.includes("<svg") ? svgMarkup : null;

  if (!raster && !svgUrl && !floor.underlayUrl) return null;

  return (
    <div
      className={cn(
        "relative mt-1 overflow-hidden border border-border bg-muted/40",
        faded && "opacity-40",
      )}
    >
      {raster ? (
        <img src={raster} alt="" className="max-h-28 w-full object-contain" />
      ) : null}
      {inlineSvg ? (
        <div
          className={cn(
            "pointer-events-none max-h-28 w-full overflow-hidden [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-h-28 [&_svg]:w-full",
            raster && "absolute inset-0 [&_image]:hidden",
          )}
          dangerouslySetInnerHTML={{ __html: inlineSvg }}
        />
      ) : svgUrl && !raster ? (
        <object
          data={svgUrl}
          type="image/svg+xml"
          aria-label="Venue drawing"
          className="max-h-28 w-full"
        />
      ) : !raster && floor.underlayUrl ? (
        <img src={floor.underlayUrl} alt="" className="max-h-28 w-full object-contain" />
      ) : null}
    </div>
  );
}
