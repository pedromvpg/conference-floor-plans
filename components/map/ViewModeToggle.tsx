"use client";

import { Box, Grid3x3, Ruler, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { HallView } from "@/lib/hall-view";
import { sliderRangeStyle } from "@/lib/hall-view";
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
    <div className="flex shrink-0 flex-nowrap justify-start gap-0.5 rounded-lg border border-border p-0.5" role="group" aria-label="Floor">
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

function HallToggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: string;
}) {
  return (
    <label className="flex h-7 cursor-pointer items-center justify-between gap-3 text-[11px]">
      <span>{children}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary"
      />
    </label>
  );
}

function HallSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label className="chrome-kicker" htmlFor={id}>
          {label}
        </Label>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        style={sliderRangeStyle(min, max, value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="chrome-slider mt-1 w-full"
      />
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
    <div className="inline-flex shrink-0 items-center" role="group" aria-label="View mode">
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

export function HallViewPanel({
  hallView,
  onHallViewChange,
}: {
  hallView: HallView;
  onHallViewChange: (patch: Partial<HallView>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="chrome-kicker mb-1.5">Camera</p>
        <div className="space-y-2">
          <HallSlider
            id="hall-elevation"
            label="Height"
            min={8}
            max={80}
            step={1}
            value={hallView.elevation}
            format={(v) => `${Math.round(v)}°`}
            onChange={(elevation) => onHallViewChange({ elevation })}
          />
          <HallSlider
            id="hall-azimuth"
            label="Angle"
            min={0}
            max={360}
            step={1}
            value={hallView.azimuth}
            format={(v) => `${Math.round(v)}°`}
            onChange={(azimuth) => onHallViewChange({ azimuth })}
          />
          <HallSlider
            id="hall-distance"
            label="Distance"
            min={0.5}
            max={2}
            step={0.05}
            value={hallView.distance}
            format={(v) => v.toFixed(2)}
            onChange={(distance) => onHallViewChange({ distance })}
          />
        </div>
      </div>
      <div>
        <p className="chrome-kicker mb-1.5">Light</p>
        <div className="space-y-2">
          <HallSlider
            id="hall-light-az"
            label="Sun angle"
            min={0}
            max={360}
            step={1}
            value={hallView.lightAzimuth}
            format={(v) => `${Math.round(v)}°`}
            onChange={(lightAzimuth) => onHallViewChange({ lightAzimuth })}
          />
          <HallSlider
            id="hall-light-el"
            label="Sun height"
            min={8}
            max={88}
            step={1}
            value={hallView.lightElevation}
            format={(v) => `${Math.round(v)}°`}
            onChange={(lightElevation) => onHallViewChange({ lightElevation })}
          />
          <HallSlider
            id="hall-light-int"
            label="Sun"
            min={0}
            max={2.5}
            step={0.05}
            value={hallView.lightIntensity}
            format={(v) => v.toFixed(2)}
            onChange={(lightIntensity) => onHallViewChange({ lightIntensity })}
          />
          <HallSlider
            id="hall-fill"
            label="Fill"
            min={0}
            max={2}
            step={0.05}
            value={hallView.fill}
            format={(v) => v.toFixed(2)}
            onChange={(fill) => onHallViewChange({ fill })}
          />
        </div>
      </div>
      <div>
        <p className="chrome-kicker mb-1.5">Atmosphere</p>
        <HallToggle checked={hallView.fog} onChange={(fog) => onHallViewChange({ fog })}>
          Fog
        </HallToggle>
        <HallSlider
          id="hall-fog"
          label="Fog density"
          min={0}
          max={1}
          step={0.02}
          value={hallView.fogIntensity}
          format={(v) => `${Math.round(v * 100)}%`}
          disabled={!hallView.fog}
          onChange={(fogIntensity) => onHallViewChange({ fogIntensity })}
        />
      </div>
      <div>
        <p className="chrome-kicker mb-1.5">Style</p>
        <HallToggle
          checked={hallView.orthographic}
          onChange={(orthographic) => onHallViewChange({ orthographic })}
        >
          Orthographic
        </HallToggle>
        <HallToggle checked={hallView.cuboids} onChange={(cuboids) => onHallViewChange({ cuboids })}>
          Cuboids
        </HallToggle>
        <HallToggle checked={hallView.ao} onChange={(ao) => onHallViewChange({ ao })}>
          AO
        </HallToggle>
        <HallToggle checked={hallView.shadows} onChange={(shadows) => onHallViewChange({ shadows })}>
          Shadows
        </HallToggle>
        <HallToggle
          checked={hallView.environment}
          onChange={(environment) => onHallViewChange({ environment })}
        >
          Environment
        </HallToggle>
        <HallToggle
          checked={hallView.pathTracing}
          onChange={(pathTracing) => onHallViewChange({ pathTracing })}
        >
          Path tracing
        </HallToggle>
      </div>
    </div>
  );
}

export const HALL_VIEW_ASIDE_W = 224;

export function HallViewAside({
  hallView,
  onHallViewChange,
  onClose,
}: {
  hallView: HallView;
  onHallViewChange: (patch: Partial<HallView>) => void;
  onClose: () => void;
}) {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-l border-border bg-background">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <p className="min-w-0 flex-1 text-[13px] font-medium">3D view</p>
        <Button size="icon-sm" variant="ghost" aria-label="Close 3D view" onClick={onClose}>
          <X strokeWidth={1.5} />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-3 py-3">
          <HallViewPanel hallView={hallView} onHallViewChange={onHallViewChange} />
        </div>
      </ScrollArea>
    </aside>
  );
}
