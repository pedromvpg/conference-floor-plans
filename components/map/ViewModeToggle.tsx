"use client";

import { Box, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "@/lib/types";

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
        <Square />
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
        <Box />
      </Button>
    </div>
  );
}
