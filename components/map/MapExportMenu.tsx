"use client";

import { useState } from "react";
import { ClipboardCopy, Download, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildHallSvg } from "@/lib/export-hall-svg";
import {
  buildFloorPlanSvg,
  copySvgForFigma,
  copySvgForIllustrator,
  downloadSvgFile,
  loadVenueSvgMarkup,
  svgForIllustrator,
} from "@/lib/export-map-svg";
import { DEFAULT_HALL_VIEW, type HallView } from "@/lib/hall-view";
import type { Floor, LibraryAsset, MapObject, Sponsor, ViewMode } from "@/lib/types";
import { toast } from "sonner";

type Props = {
  floor: Floor;
  objects: MapObject[];
  sponsors: Sponsor[];
  assets?: LibraryAsset[];
  venueSvg?: string | null;
  filename?: string;
  compact?: boolean;
  stacked?: boolean;
  viewMode?: ViewMode;
  hallView?: HallView;
};

function scaleOf(svg: string): string | undefined {
  return svg.match(/data-map-scale="([^"]+)"/)?.[1];
}

function hallFilename(filename: string | undefined, floorName: string) {
  const stem = (filename || `${floorName || "floor"}-plan.svg`).replace(/\.svg$/i, "").replace(/-plan$/i, "");
  return `${stem}-hall.svg`;
}

function useMapExport({
  floor,
  objects,
  sponsors,
  assets,
  venueSvg,
  filename,
  viewMode,
  hallView,
}: Props) {
  const [busy, setBusy] = useState(false);
  const hall = viewMode === "hall";

  async function svgMarkup() {
    const venue = await loadVenueSvgMarkup(floor, venueSvg);
    const name = filename?.replace(/\.svg$/i, "");
    if (hall) {
      return buildHallSvg({
        floor,
        objects,
        sponsors,
        venueSvg: venue,
        name,
        hallView: hallView ?? DEFAULT_HALL_VIEW,
      });
    }
    return buildFloorPlanSvg({
      floor,
      objects,
      sponsors,
      assets,
      venueSvg: venue,
      name,
    });
  }

  async function exportFile() {
    setBusy(true);
    try {
      const svg = svgForIllustrator(await svgMarkup());
      const file = hall ? hallFilename(filename, floor.name) : filename || `${floor.name || "floor"}-plan.svg`;
      downloadSvgFile(svg, file);
      const scale = scaleOf(svg);
      toast.message(
        hall
          ? "Downloaded 3D SVG — File → Open in Illustrator"
          : scale
            ? `Downloaded SVG (${scale}) — File → Open in Illustrator`
            : "Downloaded SVG — File → Open in Illustrator",
      );
    } catch {
      toast.error("Could not export SVG");
    } finally {
      setBusy(false);
    }
  }

  async function copyFigma() {
    setBusy(true);
    try {
      const svg = await svgMarkup();
      await copySvgForFigma(svg);
      const scale = scaleOf(svg);
      toast.message(
        hall ? "Copied 3D vectors — paste in Figma with ⌘V" : scale ? `Copied ${scale} — paste in Figma with ⌘V` : "Copied — paste in Figma with ⌘V",
      );
    } catch {
      toast.error("Could not copy for Figma");
    } finally {
      setBusy(false);
    }
  }

  async function copyIllustrator() {
    setBusy(true);
    try {
      const svg = await svgMarkup();
      await copySvgForIllustrator(svg);
      const scale = scaleOf(svg);
      toast.message(
        hall
          ? "Copied 3D SVG — paste in Illustrator, or File → Open if paste is empty"
          : scale
            ? `Copied ${scale} SVG — paste in Illustrator, or File → Open if paste is empty`
            : "Copied SVG — paste in Illustrator, or File → Open if paste is empty",
      );
    } catch {
      toast.error("Could not copy for Illustrator");
    } finally {
      setBusy(false);
    }
  }

  return { busy, exportFile, copyFigma, copyIllustrator, hall };
}

export function MapExportMenuItems(props: Props) {
  const { busy, exportFile, copyFigma, copyIllustrator, hall } = useMapExport(props);
  return (
    <>
      <DropdownMenuItem disabled={busy} onSelect={() => void exportFile()}>
        {hall ? "Export 3D SVG" : "Export SVG"}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={busy} onSelect={() => void copyFigma()}>
        {hall ? "Copy 3D to Figma" : "Copy to Figma"}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={busy} onSelect={() => void copyIllustrator()}>
        {hall ? "Copy 3D for Illustrator" : "Copy for Illustrator"}
      </DropdownMenuItem>
    </>
  );
}

export function MapExportMenu({ compact, stacked, ...props }: Props) {
  const { busy, exportFile, copyFigma, copyIllustrator, hall } = useMapExport(props);
  const exportLabel = hall ? "Export 3D SVG" : "Export SVG";
  const figmaLabel = hall ? "Copy 3D to Figma" : "Copy to Figma";
  const aiLabel = hall ? "Copy 3D for Illustrator" : "Copy for Illustrator";

  if (stacked) {
    return (
      <div className="flex flex-col gap-0.5">
        <Button size="sm" variant="ghost" className="h-8 justify-start px-2" disabled={busy} onClick={() => void exportFile()}>
          <Download strokeWidth={1.5} />
          {exportLabel}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 justify-start px-2" disabled={busy} onClick={() => void copyFigma()}>
          <ClipboardCopy strokeWidth={1.5} />
          {figmaLabel}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 justify-start px-2" disabled={busy} onClick={() => void copyIllustrator()}>
          <PenTool strokeWidth={1.5} />
          {aiLabel}
        </Button>
      </div>
    );
  }

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" title="Export" aria-label="Export" disabled={busy}>
            <Download strokeWidth={1.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem disabled={busy} onClick={() => void exportFile()}>
            {exportLabel}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onClick={() => void copyFigma()}>
            {figmaLabel}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onClick={() => void copyIllustrator()}>
            {aiLabel}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void exportFile()}>
        <Download strokeWidth={1.5} />
        {exportLabel}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void copyFigma()}>
        <ClipboardCopy strokeWidth={1.5} />
        {figmaLabel}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void copyIllustrator()}>
        <PenTool strokeWidth={1.5} />
        {aiLabel}
      </Button>
    </div>
  );
}
