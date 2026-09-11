"use client";

import { useState } from "react";
import { ClipboardCopy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  buildFloorPlanSvg,
  copySvgForFigma,
  downloadSvgFile,
  loadVenueSvgMarkup,
} from "@/lib/export-map-svg";
import type { Floor, LibraryAsset, MapObject, Sponsor } from "@/lib/types";
import { toast } from "sonner";

type Props = {
  floor: Floor;
  objects: MapObject[];
  sponsors: Sponsor[];
  assets?: LibraryAsset[];
  venueSvg?: string | null;
  filename?: string;
  compact?: boolean;
};

export function MapExportMenu({
  floor,
  objects,
  sponsors,
  assets,
  venueSvg,
  filename,
  compact,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function svgMarkup() {
    const venue = await loadVenueSvgMarkup(floor, venueSvg);
    return buildFloorPlanSvg({
      floor,
      objects,
      sponsors,
      assets,
      venueSvg: venue,
      name: filename?.replace(/\.svg$/i, ""),
    });
  }

  async function exportFile() {
    setBusy(true);
    try {
      const svg = await svgMarkup();
      downloadSvgFile(svg, filename || `${floor.name || "floor"}-plan.svg`);
      toast.message("Downloaded layered SVG");
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
      toast.message("Copied — paste in Figma with ⌘V");
    } catch {
      toast.error("Could not copy for Figma");
    } finally {
      setBusy(false);
    }
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
            Export SVG
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onClick={() => void copyFigma()}>
            Copy to Figma
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void exportFile()}>
        <Download strokeWidth={1.5} />
        Export SVG
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void copyFigma()}>
        <ClipboardCopy strokeWidth={1.5} />
        Copy to Figma
      </Button>
    </div>
  );
}
