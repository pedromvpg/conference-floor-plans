"use client";

import { Box, Grid3x3, Ruler, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "@/lib/types";

export function GridToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (show: boolean) => void;
}) {
  return (
    <Button
      size="icon-sm"
      variant={value ? "secondary" : "ghost"}
      title={value ? "Hide grid" : "Show grid"}
      aria-label={value ? "Hide grid" : "Show grid"}
      aria-pressed={value}
      onClick={() => onChange(!value)}
    >
      <Grid3x3 strokeWidth={1.5} />
    </Button>
  );
}

export function RulersToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (show: boolean) => void;
}) {
  return (
    <Button
      size="icon-sm"
      variant={value ? "secondary" : "ghost"}
      title={value ? "Hide rulers" : "Show rulers"}
      aria-label={value ? "Hide rulers" : "Show rulers"}
      aria-pressed={value}
      onClick={() => onChange(!value)}
    >
      <Ruler strokeWidth={1.5} />
    </Button>
  );
}

export function FloorSwitcher({
  floors,
  value,
  onChange,
}: {
  floors: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (floors.length < 2) return null;
  return (
    <div className="flex flex-wrap justify-start gap-0.5 rounded-lg border border-border p-0.5" role="group" aria-label="Floor">
      {floors.map((f, i) => (
        <button
          key={f.id}
          type="button"
          className={`h-8 rounded-md px-2.5 text-[11px] font-medium ${
            f.id === value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          data-active={f.id === value}
          onClick={() => onChange(f.id)}
        >
          {f.name || `Level ${i + 1}`}
        </button>
      ))}
    </div>
  );
}

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center" role="group" aria-label="View mode">
      <Button
        size="icon-sm"
        variant={value === "plan" ? "secondary" : "ghost"}
        className="size-8"
        title="2D"
        aria-label="2D plan"
        aria-pressed={value === "plan"}
        onClick={() => onChange("plan")}
      >
        <Square strokeWidth={1.5} />
      </Button>
      <Button
        size="icon-sm"
        variant={value === "hall" ? "secondary" : "ghost"}
        className="size-8"
        title="3D"
        aria-label="3D hall"
        aria-pressed={value === "hall"}
        onClick={() => onChange("hall")}
      >
        <Box strokeWidth={1.5} />
      </Button>
    </div>
  );
}
