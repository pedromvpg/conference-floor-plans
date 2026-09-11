"use client";

import { Aperture, Box, Boxes, CloudFog, Cuboid, Grid3x3, Ruler, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  orthographic,
  onOrthographicChange,
  cuboids,
  onCuboidsChange,
  fog,
  onFogChange,
  ao,
  onAoChange,
  shadows,
  onShadowsChange,
  environment,
  onEnvironmentChange,
  pathTracing,
  onPathTracingChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  orthographic?: boolean;
  onOrthographicChange?: (ortho: boolean) => void;
  cuboids?: boolean;
  onCuboidsChange?: (cuboids: boolean) => void;
  fog?: boolean;
  onFogChange?: (fog: boolean) => void;
  ao?: boolean;
  onAoChange?: (ao: boolean) => void;
  shadows?: boolean;
  onShadowsChange?: (shadows: boolean) => void;
  environment?: boolean;
  onEnvironmentChange?: (environment: boolean) => void;
  pathTracing?: boolean;
  onPathTracingChange?: (pathTracing: boolean) => void;
}) {
  const lookActive = Boolean(ao || shadows || environment || pathTracing);
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
      {value === "hall" && onOrthographicChange ? (
        <Button
          size="icon-sm"
          variant={orthographic ? "secondary" : "ghost"}
          className="size-8"
          title={orthographic ? "Perspective" : "Orthographic"}
          aria-label={orthographic ? "Switch to perspective" : "Switch to orthographic"}
          aria-pressed={Boolean(orthographic)}
          onClick={() => onOrthographicChange(!orthographic)}
        >
          <Cuboid strokeWidth={1.5} />
        </Button>
      ) : null}
      {value === "hall" && onCuboidsChange ? (
        <Button
          size="icon-sm"
          variant={cuboids ? "secondary" : "ghost"}
          className="size-8"
          title={cuboids ? "Show back walls" : "Show cuboids"}
          aria-label={cuboids ? "Switch to back walls" : "Switch to cuboids"}
          aria-pressed={Boolean(cuboids)}
          onClick={() => onCuboidsChange(!cuboids)}
        >
          <Boxes strokeWidth={1.5} />
        </Button>
      ) : null}
      {value === "hall" && onFogChange ? (
        <Button
          size="icon-sm"
          variant={fog ? "secondary" : "ghost"}
          className="size-8"
          title={fog ? "Hide fog" : "Show fog"}
          aria-label={fog ? "Hide fog" : "Show fog"}
          aria-pressed={Boolean(fog)}
          onClick={() => onFogChange(!fog)}
        >
          <CloudFog strokeWidth={1.5} />
        </Button>
      ) : null}
      {value === "hall" && onAoChange && onShadowsChange && onEnvironmentChange && onPathTracingChange ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-sm"
              variant={lookActive ? "secondary" : "ghost"}
              className="size-8"
              title="3D look"
              aria-label="3D look"
            >
              <Aperture strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-48">
            <DropdownMenuLabel>Look</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onAoChange(!ao);
              }}
            >
              Ambient occlusion
              {ao ? <span className="ml-auto text-muted-foreground">On</span> : null}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onShadowsChange(!shadows);
              }}
            >
              Shadows
              {shadows ? <span className="ml-auto text-muted-foreground">On</span> : null}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onEnvironmentChange(!environment);
              }}
            >
              Environment light
              {environment ? <span className="ml-auto text-muted-foreground">On</span> : null}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onPathTracingChange(!pathTracing);
              }}
            >
              Path tracing
              {pathTracing ? <span className="ml-auto text-muted-foreground">On</span> : null}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
