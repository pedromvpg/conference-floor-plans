"use client";

import { Box, Grid3x3, Square } from "lucide-react";
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
      variant={value ? "default" : "outline"}
      title={value ? "Hide grid" : "Show grid"}
      aria-label={value ? "Hide grid" : "Show grid"}
      aria-pressed={value}
      onClick={() => onChange(!value)}
    >
      <Grid3x3 />
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
    <div className="flex flex-wrap justify-start gap-1" role="group" aria-label="Floor">
      {floors.map((f, i) => (
        <button
          key={f.id}
          type="button"
          className="chrome-pill"
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
    <div className="flex border border-border" role="group" aria-label="View mode">
      <Button
        size="icon-sm"
        variant={value === "plan" ? "default" : "ghost"}
        className="rounded-none"
        title="2D"
        aria-label="2D plan"
        aria-pressed={value === "plan"}
        onClick={() => onChange("plan")}
      >
        <Square strokeWidth={1.25} />
      </Button>
      <Button
        size="icon-sm"
        variant={value === "hall" ? "default" : "ghost"}
        className="rounded-none"
        title="3D"
        aria-label="3D hall"
        aria-pressed={value === "hall"}
        onClick={() => onChange("hall")}
      >
        <Box strokeWidth={1.25} />
      </Button>
    </div>
  );
}
